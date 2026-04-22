const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

function validateEvent(data) {
  if (!data.title || data.title.trim() === '') return '标题不能为空'
  if (!data.startTime) return '开始时间不能为空'
  if (!data.endTime) return '结束时间不能为空'
  if (new Date(data.startTime) > new Date(data.endTime)) return '开始时间不能晚于结束时间'
  return null
}

async function mainCreateEvent(eventData, openid) {
  const err = validateEvent(eventData)
  if (err) return { code: 400, msg: err }

  const { familyId, title, type, participants, isAllDay, startTime, endTime, repeatRule, location, remark, tag, visibility, reminders } = eventData

  // 校验用户是否属于该家庭
  const family = await db.collection('families').doc(familyId).get()
  if (!family.data) return { code: 404, msg: '家庭不存在' }
  const isMember = family.data.members.some(m => m.openid === openid)
  if (!isMember) return { code: 403, msg: '无权访问该家庭' }

  const now = db.serverDate()
  const eventDoc = {
    familyId,
    creatorOpenid: openid,
    title: title.trim(),
    type: type || 'personal',
    participants: participants || [openid],
    isAllDay: !!isAllDay,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    repeatRule: repeatRule || null,
    location: location || '',
    remark: remark || '',
    tag: tag || '',
    visibility: visibility || (type === 'family' ? 'family' : 'private'),
    reminders: reminders || [],
    isDone: false,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('events').add({ data: eventDoc })
  return { code: 200, data: { _id: res._id, ...eventDoc } }
}

async function mainUpdateEvent(eventData, openid) {
  const { eventId, ...updateFields } = eventData

  if (!eventId) return { code: 400, msg: 'eventId不能为空' }

  const eventRes = await db.collection('events').doc(eventId).get()
  const evt = eventRes.data
  if (!evt) return { code: 404, msg: '日程不存在' }

  // 校验权限：创建者、管理员可编辑所有；普通成员只能编辑自己的
  const family = await db.collection('families').doc(evt.familyId).get()
  const member = family.data.members.find(m => m.openid === openid)
  if (!member) return { code: 403, msg: '无权访问' }

  const canEdit = evt.creatorOpenid === openid || member.role === 'creator' || member.role === 'admin'
  if (!canEdit) return { code: 403, msg: '无权编辑此日程' }

  const allowedFields = ['title', 'type', 'participants', 'isAllDay', 'startTime', 'endTime', 'repeatRule', 'location', 'remark', 'tag', 'visibility', 'reminders', 'isDone']
  const updateData = { updatedAt: db.serverDate() }

  for (const key of allowedFields) {
    if (updateFields[key] !== undefined) {
      if (key === 'startTime' || key === 'endTime') {
        updateData[key] = new Date(updateFields[key])
      } else {
        updateData[key] = updateFields[key]
      }
    }
  }

  await db.collection('events').doc(eventId).update({ data: updateData })
  return { code: 200, msg: '更新成功' }
}

async function mainDeleteEvent(eventData, openid) {
  const { eventId } = eventData
  if (!eventId) return { code: 400, msg: 'eventId不能为空' }

  const eventRes = await db.collection('events').doc(eventId).get()
  const evt = eventRes.data
  if (!evt) return { code: 404, msg: '日程不存在' }

  const family = await db.collection('families').doc(evt.familyId).get()
  const member = family.data.members.find(m => m.openid === openid)
  if (!member) return { code: 403, msg: '无权访问' }

  const canDelete = evt.creatorOpenid === openid || member.role === 'creator' || member.role === 'admin'
  if (!canDelete) return { code: 403, msg: '无权删除此日程' }

  await db.collection('events').doc(eventId).remove()
  return { code: 200, msg: '删除成功' }
}

async function mainGetEvent(eventData, openid) {
  const { eventId } = eventData
  if (!eventId) return { code: 400, msg: 'eventId不能为空' }

  const eventRes = await db.collection('events').doc(eventId).get()
  const evt = eventRes.data
  if (!evt) return { code: 404, msg: '日程不存在' }

  // 权限检查
  const family = await db.collection('families').doc(evt.familyId).get()
  const member = family.data.members.find(m => m.openid === openid)
  if (!member) return { code: 403, msg: '无权访问' }

  // 个人日程且仅自己可见
  if (evt.type === 'personal' && evt.visibility === 'private' && evt.creatorOpenid !== openid) {
    return { code: 403, msg: '无权查看' }
  }

  return { code: 200, data: evt }
}

async function mainGetMonthlyEvents(eventData, openid) {
  const { familyId, year, month } = eventData

  if (!familyId || !year || !month) {
    return { code: 400, msg: '参数不完整' }
  }

  // 校验成员身份
  const family = await db.collection('families').doc(familyId).get()
  if (!family.data) return { code: 404, msg: '家庭不存在' }
  const member = family.data.members.find(m => m.openid === openid)
  if (!member) return { code: 403, msg: '无权访问' }

  const start = new Date(year, month - 1, 1, 0, 0, 0)
  const end = new Date(year, month, 1, 0, 0, 0)

  // 查询当月日程：包括当月内开始或结束的，或者跨越当月的
  const eventsRes = await db.collection('events').where({
    familyId,
    $or: [
      { startTime: _.gte(start).and(_.lt(end)) },
      { endTime: _.gte(start).and(_.lt(end)) },
      { startTime: _.lt(start), endTime: _.gte(end) }
    ]
  }).orderBy('startTime', 'asc').get()

  // 过滤不可见的个人日程
  const visibleEvents = eventsRes.data.filter(evt => {
    if (evt.type === 'personal' && evt.visibility === 'private') {
      return evt.creatorOpenid === openid
    }
    return true
  })

  return { code: 200, data: visibleEvents }
}

async function mainGetDailyEvents(eventData, openid) {
  const { familyId, date } = eventData

  if (!familyId || !date) {
    return { code: 400, msg: '参数不完整' }
  }

  const family = await db.collection('families').doc(familyId).get()
  if (!family.data) return { code: 404, msg: '家庭不存在' }
  const member = family.data.members.find(m => m.openid === openid)
  if (!member) return { code: 403, msg: '无权访问' }

  const dayStart = new Date(date + 'T00:00:00')
  const dayEnd = new Date(date + 'T23:59:59')

  const eventsRes = await db.collection('events').where({
    familyId,
    $or: [
      { startTime: _.gte(dayStart).and(_.lte(dayEnd)) },
      { endTime: _.gte(dayStart).and(_.lte(dayEnd)) },
      { startTime: _.lt(dayStart), endTime: _.gt(dayEnd) }
    ]
  }).orderBy('startTime', 'asc').get()

  const visibleEvents = eventsRes.data.filter(evt => {
    if (evt.type === 'personal' && evt.visibility === 'private') {
      return evt.creatorOpenid === openid
    }
    return true
  })

  return { code: 200, data: visibleEvents }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: 401, msg: '未获取到用户信息' }
  }

  const { action, ...data } = event

  switch (action) {
    case 'create': return await mainCreateEvent(data, openid)
    case 'update': return await mainUpdateEvent(data, openid)
    case 'delete': return await mainDeleteEvent(data, openid)
    case 'get': return await mainGetEvent(data, openid)
    case 'getMonthly': return await mainGetMonthlyEvents(data, openid)
    case 'getDaily': return await mainGetDailyEvents(data, openid)
    default: return { code: 400, msg: '未知操作' }
  }
}
