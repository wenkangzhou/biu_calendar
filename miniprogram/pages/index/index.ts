import { getMonthlyEvents, getDailyEvents, getFamily, getToken } from '../../utils/api'

const { Solar } = require('../../utils/lunar-javascript/index')

const app = getApp<any>()

Page({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    today: '',
    selectedDate: '',
    weekdayText: '',
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
    this.setData({
      today,
      selectedDate: today,
      weekdayText: this.getWeekdayText(new Date())
    })
    this.buildCalendar()

    // 如果登录还在进行中，先等待
    if (!getToken() && app.loginPromise) {
      await app.loginPromise
    }
    await this.loadFamilyAndEvents()
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    await this.loadFamilyAndEvents()
  },

  async loadFamilyAndEvents() {
    try {
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
    const { family, memberMap } = this.data
    if (!family) return
    try {
      const res: any = await getDailyEvents(family._id, dateStr)
      if (res.code === 200) {
        const list = res.data.sort((a: any, b: any) => {
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        }).map((e: any) => {
          const m = memberMap[e.creator_openid]
          return {
            ...e,
            creatorColor: m ? m.color : '#999',
            creatorAvatarText: m && (m.avatarUrl || m.nickName) ? (m.avatarUrl || m.nickName[0]) : '?' 
          }
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
    const startWeekday = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: any[] = []
    for (let i = 0; i < startWeekday; i++) {
      days.push({ day: 0, date: '', dots: [] })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      // 计算农历/节假日
      let lunarText = ''
      try {
        const solar = Solar.fromYmd(year, month, d)
        const lunar = solar.getLunar()
        const festivals = solar.getFestivals()
        const lunarFestivals = lunar.getFestivals()
        const jieQi = lunar.getJieQi()
        if (festivals && festivals.length > 0) {
          lunarText = festivals[0]
        } else if (lunarFestivals && lunarFestivals.length > 0) {
          lunarText = lunarFestivals[0]
        } else if (jieQi) {
          lunarText = jieQi
        } else if (lunar.getDay() === 1) {
          lunarText = lunar.getMonthInChinese() + '月'
        } else {
          lunarText = lunar.getDayInChinese()
        }
      } catch (e) {
        // 忽略农历计算错误
      }
      days.push({ day: d, date: dateStr, dots: [], lunarText })
    }
    this.setData({ calendarDays: days })
  },

  updateCalendarDots() {
    const { calendarDays, events, memberMap } = this.data
    const updatedDays = calendarDays.map((cell: any) => {
      if (!cell.date) return cell
      const dayEvents = events.filter((e: any) => {
        const s = new Date(e.start_time)
        const en = new Date(e.end_time)
        const c = new Date(cell.date + 'T00:00:00')
        const cEnd = new Date(cell.date + 'T23:59:59')
        return s <= cEnd && en >= c
      })
      // 收集当天所有不同成员的颜色小圆点
      const seen = new Set<string>()
      const dots: string[] = []
      for (const e of dayEvents) {
        const oid = e.creator_openid
        if (memberMap[oid] && memberMap[oid].color) {
          if (!seen.has(oid)) {
            seen.add(oid)
            dots.push(memberMap[oid].color)
            if (dots.length >= 4) break
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
    this.setData({
      selectedDate: date,
      weekdayText: this.getWeekdayText(new Date(date + 'T00:00:00'))
    })
    this.loadDailyEvents(date)
  },

  onGoToday() {
    const today = this.formatDate(new Date())
    const now = new Date()
    let { year, month } = this.data
    if (year !== now.getFullYear() || month !== now.getMonth() + 1) {
      year = now.getFullYear()
      month = now.getMonth() + 1
      this.setData({ year, month, selectedDate: today, weekdayText: this.getWeekdayText(now) }, () => {
        this.buildCalendar()
        this.loadEvents().then(() => this.updateCalendarDots())
        this.loadDailyEvents(today)
      })
    } else {
      this.setData({ selectedDate: today, weekdayText: this.getWeekdayText(now) })
      this.loadDailyEvents(today)
    }
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
    wx.switchTab({ url: '/pages/family/family' })
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
  },

  getWeekdayText(d: Date) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[d.getDay()]
  },

  onShareAppMessage() {
    const { family } = this.data
    return {
      title: family ? `${family.name}的家庭日历` : '家庭共享日历',
      path: '/pages/index/index'
    }
  }
})
