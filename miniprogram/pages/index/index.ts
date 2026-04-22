import { getMonthlyEvents, getDailyEvents, getFamily } from '../../utils/cloud'

const app = getApp<IAppOption>()

Page({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    today: '',
    selectedDate: '',
    calendarDays: [] as any[],
    events: [] as any[],
    dailyEvents: [] as any[],
    family: null as any,
    memberMap: {} as Record<string, any>,
    hasFamily: false,
    loading: true
  },

  async onLoad() {
    const today = this.formatDate(new Date())
    this.setData({ today, selectedDate: today })
    this.buildCalendar()
    await this.loadFamilyAndEvents()
  },

  async onShow() {
    // 每次显示都刷新数据（可能从编辑页回来）
    if (this.data.hasFamily) {
      await this.loadEvents()
      this.updateCalendarDots()
      this.loadDailyEvents(this.data.selectedDate)
    }
  },

  async loadFamilyAndEvents() {
    try {
      // 先尝试从全局获取
      let family = app.globalData.family
      if (!family) {
        const res: any = await getFamily()
        if (res.code === 200) {
          family = res.data
          app.globalData.family = family
          const map: Record<string, any> = {}
          family.members.forEach((m: any) => { map[m.openid] = m })
          app.globalData.memberMap = map
        }
      }

      if (family) {
        const memberMap = app.globalData.memberMap || {}
        this.setData({
          family,
          memberMap,
          hasFamily: true,
          loading: false
        })
        await this.loadEvents()
        this.updateCalendarDots()
        this.loadDailyEvents(this.data.selectedDate)
      } else {
        this.setData({ hasFamily: false, loading: false })
      }
    } catch (err) {
      this.setData({ hasFamily: false, loading: false })
    }
  },

  async loadEvents() {
    const { family, year, month } = this.data
    if (!family) return
    try {
      const res: any = await getMonthlyEvents(family._id, year, month)
      if (res.code === 200) {
        this.setData({ events: res.data })
      }
    } catch (err) {
      console.error('加载日程失败', err)
    }
  },

  async loadDailyEvents(dateStr: string) {
    const { family } = this.data
    if (!family) return
    try {
      const res: any = await getDailyEvents(family._id, dateStr)
      if (res.code === 200) {
        // 按时间排序
        const list = res.data.sort((a: any, b: any) => {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        })
        this.setData({ dailyEvents: list })
      }
    } catch (err) {
      console.error('加载当日日程失败', err)
    }
  },

  buildCalendar() {
    const { year, month } = this.data
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startWeekday = firstDay.getDay() // 0=周日
    const daysInMonth = lastDay.getDate()

    const days: any[] = []
    // 填充前导空白
    for (let i = 0; i < startWeekday; i++) {
      days.push({ day: 0, date: '', dots: [] })
    }
    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, date: dateStr, dots: [] })
    }
    this.setData({ calendarDays: days })
  },

  updateCalendarDots() {
    const { calendarDays, events, memberMap } = this.data
    const updatedDays = calendarDays.map((cell: any) => {
      if (!cell.date) return cell
      const dayEvents = events.filter((e: any) => {
        const s = new Date(e.startTime)
        const en = new Date(e.endTime)
        const c = new Date(cell.date + 'T00:00:00')
        const cEnd = new Date(cell.date + 'T23:59:59')
        return s <= cEnd && en >= c
      })
      // 取最多3个不同成员的颜色点
      const seen = new Set<string>()
      const dots: string[] = []
      for (const e of dayEvents) {
        const oid = e.creatorOpenid
        if (memberMap[oid] && memberMap[oid].color) {
          if (!seen.has(oid)) {
            seen.add(oid)
            dots.push(memberMap[oid].color)
            if (dots.length >= 3) break
          }
        }
      }
      return { ...cell, dots, eventCount: dayEvents.length }
    })
    this.setData({ calendarDays: updatedDays })
  },

  onSelectDate(e: any) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({ selectedDate: date })
    this.loadDailyEvents(date)
  },

  onPrevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month }, () => {
      this.buildCalendar()
      this.loadEvents().then(() => this.updateCalendarDots())
    })
  },

  onNextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month }, () => {
      this.buildCalendar()
      this.loadEvents().then(() => this.updateCalendarDots())
    })
  },

  onGoFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  onAddEvent() {
    const { selectedDate, family } = this.data
    if (!family) {
      wx.showToast({ title: '请先创建或加入家庭', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/event-edit/event-edit?date=${selectedDate}&familyId=${family._id}`
    })
  },

  onEditEvent(e: any) {
    const eventId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/event-edit/event-edit?id=${eventId}&familyId=${this.data.family._id}`
    })
  },

  formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  formatTime(iso: string) {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  getMemberColor(openid: string) {
    const m = this.data.memberMap[openid]
    return m ? m.color : '#999'
  },

  getMemberName(openid: string) {
    const m = this.data.memberMap[openid]
    return m ? m.nickName : '未知'
  }
})
