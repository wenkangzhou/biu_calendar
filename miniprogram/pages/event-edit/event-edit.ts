import { createEvent, updateEvent, getEvent, deleteEvent, getToken } from '../../utils/api'

const app = getApp<any>()

Page({
  data: {
    isEdit: false,
    eventId: '',
    familyId: '',
    family: null as any,
    memberMap: {} as Record<string, any>,

    title: '',
    type: 'personal',
    participants: [] as string[],
    isAllDay: false,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    remark: ''
  },

  async onLoad(options: any) {
    if (!getToken() && app.loginPromise) {
      await app.loginPromise
    }
    const family = app.globalData.family
    const memberMap = app.globalData.memberMap || {}
    this.setData({ family, memberMap, familyId: options.familyId || (family && family._id) || '' })

    if (options.id) {
      this.setData({ isEdit: true, eventId: options.id })
      await this.loadEvent(options.id)
    } else {
      const dateStr = options.date || this.formatDate(new Date())
      this.setData({
        startDate: dateStr,
        startTime: '09:00',
        endDate: dateStr,
        endTime: '10:00',
        participants: [app.globalData.openid || '']
      })
    }
  },

  async loadEvent(eventId: string) {
    wx.showLoading({ title: '加载中' })
    try {
      const res: any = await getEvent(eventId)
      if (res.code === 200) {
        const e = res.data
        const start = new Date(e.start_time)
        const end = new Date(e.end_time)
        this.setData({
          title: e.title,
          type: e.type,
          participants: e.participants || [],
          isAllDay: e.is_all_day,
          startDate: this.formatDate(start),
          startTime: this.formatTime(start),
          endDate: this.formatDate(end),
          endTime: this.formatTime(end),
          location: e.location || '',
          remark: e.remark || ''
        })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onTitleChange(e: any) { this.setData({ title: e.detail.value }) },
  onTypeChange(e: any) {
    const type = e.detail.value
    const participants = type === 'family'
      ? (this.data.family?.members || []).map((m: any) => m.openid)
      : [app.globalData.openid]
    this.setData({ type, participants })
  },
  onAllDayChange(e: any) { this.setData({ isAllDay: e.detail.value }) },
  onStartDateChange(e: any) { this.setData({ startDate: e.detail.value }) },
  onStartTimeChange(e: any) { this.setData({ startTime: e.detail.value }) },
  onEndDateChange(e: any) { this.setData({ endDate: e.detail.value }) },
  onEndTimeChange(e: any) { this.setData({ endTime: e.detail.value }) },
  onLocationChange(e: any) { this.setData({ location: e.detail.value }) },
  onRemarkChange(e: any) { this.setData({ remark: e.detail.value }) },

  onParticipantToggle(e: any) {
    const openid = e.currentTarget.dataset.id
    let { participants } = this.data
    if (participants.includes(openid)) {
      participants = participants.filter((id: string) => id !== openid)
    } else {
      participants.push(openid)
    }
    this.setData({ participants })
  },

  async onSubmit() {
    const { isEdit, eventId, familyId, title, type, participants, isAllDay, startDate, startTime, endDate, endTime, location, remark } = this.data

    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }

    const start = isAllDay
      ? new Date(startDate + 'T00:00:00')
      : new Date(startDate + 'T' + startTime)
    const end = isAllDay
      ? new Date(endDate + 'T23:59:59')
      : new Date(endDate + 'T' + endTime)

    if (start >= end) {
      wx.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
      return
    }

    const payload: any = {
      familyId,
      title: title.trim(),
      type,
      participants,
      isAllDay,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      location,
      remark
    }

    wx.showLoading({ title: isEdit ? '保存中' : '创建中' })
    try {
      let res: any
      if (isEdit) {
        res = await updateEvent(eventId, payload)
      } else {
        res = await createEvent(payload)
      }

      if (res.code === 200) {
        wx.showToast({ title: isEdit ? '保存成功' : '创建成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      } else {
        wx.showToast({ title: res.msg || '操作失败', icon: 'none' })
      }
    } catch (err: any) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async onDelete() {
    const { eventId } = this.data
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          try {
            const ret: any = await deleteEvent(eventId)
            if (ret.code === 200) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 800)
            } else {
              wx.showToast({ title: ret.msg || '删除失败', icon: 'none' })
            }
          } catch (err: any) {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },
  formatTime(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
})
