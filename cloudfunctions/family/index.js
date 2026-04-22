const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function getMemberColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  return colors[index % colors.length]
}

async function mainCreateFamily(event, openid) {
  const { name, nickName, identityTag } = event

  if (!name || !nickName) {
    return { code: 400, msg: '家庭名称和昵称不能为空' }
  }

  // 检查用户是否已有家庭
  const exist = await db.collection('families').where({
    'members.openid': openid
  }).get()

  if (exist.data.length > 0) {
    return { code: 409, msg: '您已加入一个家庭，请先退出' }
  }

  const inviteCode = generateInviteCode()
  const now = db.serverDate()
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const family = {
    name,
    creatorOpenid: openid,
    members: [{
      openid,
      nickName,
      identityTag: identityTag || '其他',
      color: getMemberColor(0),
      role: 'creator',
      joinedAt: now
    }],
    inviteCode,
    inviteCodeExpireAt: expireAt,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('families').add({ data: family })
  return { code: 200, data: { familyId: res._id, ...family } }
}

async function mainJoinFamily(event, openid) {
  const { inviteCode, nickName, identityTag } = event

  if (!inviteCode || !nickName) {
    return { code: 400, msg: '邀请码和昵称不能为空' }
  }

  // 查找家庭
  const familyRes = await db.collection('families').where({
    inviteCode
  }).get()

  if (familyRes.data.length === 0) {
    return { code: 404, msg: '邀请码无效' }
  }

  const family = familyRes.data[0]

  // 检查是否过期
  if (new Date(family.inviteCodeExpireAt) < new Date()) {
    return { code: 410, msg: '邀请码已过期' }
  }

  // 检查是否已在家庭中
  if (family.members.some(m => m.openid === openid)) {
    return { code: 409, msg: '您已在该家庭中' }
  }

  // 检查用户是否在其他家庭
  const otherFamily = await db.collection('families').where({
    'members.openid': openid
  }).get()

  if (otherFamily.data.length > 0) {
    return { code: 409, msg: '您已加入其他家庭，请先退出' }
  }

  const now = db.serverDate()
  const newMember = {
    openid,
    nickName,
    identityTag: identityTag || '其他',
    color: getMemberColor(family.members.length),
    role: 'member',
    joinedAt: now
  }

  await db.collection('families').doc(family._id).update({
    data: {
      members: _.push(newMember),
      updatedAt: now
    }
  })

  family.members.push(newMember)
  return { code: 200, data: family }
}

async function mainGetFamily(event, openid) {
  const familyRes = await db.collection('families').where({
    'members.openid': openid
  }).get()

  if (familyRes.data.length === 0) {
    return { code: 404, msg: '未加入任何家庭' }
  }

  return { code: 200, data: familyRes.data[0] }
}

async function mainRefreshInviteCode(event, openid) {
  const { familyId } = event

  const familyRes = await db.collection('families').doc(familyId).get()
  const family = familyRes.data

  if (!family) return { code: 404, msg: '家庭不存在' }
  if (family.creatorOpenid !== openid) return { code: 403, msg: '无权操作' }

  const inviteCode = generateInviteCode()
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db.collection('families').doc(familyId).update({
    data: { inviteCode, inviteCodeExpireAt: expireAt, updatedAt: db.serverDate() }
  })

  return { code: 200, data: { inviteCode, inviteCodeExpireAt: expireAt } }
}

async function mainLeaveFamily(event, openid) {
  const { familyId } = event

  const familyRes = await db.collection('families').doc(familyId).get()
  const family = familyRes.data

  if (!family) return { code: 404, msg: '家庭不存在' }

  const memberIndex = family.members.findIndex(m => m.openid === openid)
  if (memberIndex === -1) return { code: 403, msg: '您不在该家庭中' }

  // 创建者不能退出，只能解散
  if (family.members[memberIndex].role === 'creator') {
    return { code: 403, msg: '创建者不能退出，请解散家庭' }
  }

  const newMembers = family.members.filter(m => m.openid !== openid)
  await db.collection('families').doc(familyId).update({
    data: { members: newMembers, updatedAt: db.serverDate() }
  })

  return { code: 200, msg: '已退出家庭' }
}

async function mainDissolveFamily(event, openid) {
  const { familyId } = event

  const familyRes = await db.collection('families').doc(familyId).get()
  const family = familyRes.data

  if (!family) return { code: 404, msg: '家庭不存在' }
  if (family.creatorOpenid !== openid) return { code: 403, msg: '无权操作' }

  // 删除家庭下所有日程
  await db.collection('events').where({ familyId }).remove()

  // 删除家庭
  await db.collection('families').doc(familyId).remove()

  return { code: 200, msg: '家庭已解散' }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: 401, msg: '未获取到用户信息' }
  }

  const { action } = event

  switch (action) {
    case 'create': return await mainCreateFamily(event, openid)
    case 'join': return await mainJoinFamily(event, openid)
    case 'get': return await mainGetFamily(event, openid)
    case 'refreshInviteCode': return await mainRefreshInviteCode(event, openid)
    case 'leave': return await mainLeaveFamily(event, openid)
    case 'dissolve': return await mainDissolveFamily(event, openid)
    default: return { code: 400, msg: '未知操作' }
  }
}
