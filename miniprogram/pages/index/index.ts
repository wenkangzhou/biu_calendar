import { getMonthlyEvents, getDailyEvents, getFamily, getToken, updateEvent, request } from '../../utils/api'

const { Solar, HolidayUtil } = require('../../utils/lunar-javascript/index')

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
    familyMembers: [] as any[],
    hasFamily: false,
    loading: true,
    reviewMode: true,
    viewMode: 'month' as 'month' | 'week',
    weekDays: [] as any[],
    weekEvents: [] as any[],
    weekRangeText: '',
    searchQuery: '',
    searchResults: [] as any[],
    isSearching: false
  },

  async onLoad() {
    const today = this.formatDate(new Date())
    this.setData({
      today,
      selectedDate: today,
      weekdayText: this.getWeekdayText(new Date()),
      reviewMode: app.globalData.reviewMode || false
    })
    this.buildCalendar()

    // 如果登录还在进行中，先等待
    if (!getToken() && app.loginPromise) {
      await app.loginPromise
    }
    await this.loadFamilyAndEvents()
  },

  async onShow() {
    this.setData({ reviewMode: app.globalData.reviewMode || false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ reviewMode: app.globalData.reviewMode || false })
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
        const familyMembers = (family.members || []).slice(0, 4).map((m: any) => ({
          color: m.color || '#999',
          avatarText: m.avatarUrl || (m.nickName ? m.nickName[0] : '?')
        }))
        this.setData({
          family,
          memberMap,
          familyMembers,
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
            creatorAvatarText: m && (m.avatarUrl || m.nickName) ? (m.avatarUrl || m.nickName[0]) : '?',
            timeText: e.is_all_day ? '全天' : `${this.formatTime(e.start_time)} - ${this.formatTime(e.end_time)}`
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
      let isHoliday = false
      let isWork = false
      try {
        const solar = Solar.fromYmd(year, month, d)
        const lunar = solar.getLunar()
        const holiday = HolidayUtil.getHoliday(year, month, d)
        if (holiday) {
          lunarText = holiday.getName() + (holiday.isWork() ? '(班)' : '(休)')
          isHoliday = !holiday.isWork()
          isWork = holiday.isWork()
        } else {
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
        }
      } catch (e) {
        // 忽略农历计算错误
      }
      days.push({ day: d, date: dateStr, dots: [], lunarText, isHoliday, isWork })
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
      // 收集当天所有不同成员的颜色小圆点，已完成的显示灰色
      const memberStatus: Record<string, { color: string, hasUndone: boolean }> = {}
      for (const e of dayEvents) {
        const oid = e.creator_openid
        if (memberMap[oid] && memberMap[oid].color) {
          if (!memberStatus[oid]) {
            memberStatus[oid] = { color: memberMap[oid].color, hasUndone: !e.is_done }
          } else if (!e.is_done) {
            memberStatus[oid].hasUndone = true
          }
        }
      }
      const dots = Object.values(memberStatus)
        .map(s => s.hasUndone ? s.color : '#CBD5E1')
        .slice(0, 4)
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
    let { year, month, viewMode } = this.data
    if (viewMode === 'week') {
      this.setData({ selectedDate: today, weekdayText: this.getWeekdayText(now) }, () => {
        this.buildWeekView()
        this.loadDailyEvents(today)
      })
      return
    }
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

  async toggleDone(e: any) {
    const id = e.currentTarget.dataset.id
    const { dailyEvents, events } = this.data
    const eventItem = dailyEvents.find((e: any) => e._id === id)
    if (!eventItem) return
    const newDone = !eventItem.is_done
    try {
      const res: any = await updateEvent(id, { isDone: newDone })
      if (res.code === 200) {
        // 更新本地状态
        const updatedDaily = dailyEvents.map((e: any) =>
          e._id === id ? { ...e, is_done: newDone } : e
        )
        const updatedEvents = events.map((e: any) =>
          e._id === id ? { ...e, is_done: newDone } : e
        )
        this.setData({ dailyEvents: updatedDaily, events: updatedEvents }, () => {
          this.updateCalendarDots()
          if (this.data.viewMode === 'week') {
            this.calcWeekEvents()
          }
        })
      }
    } catch (err) {
      console.error('更新完成状态失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onSearchInput(e: any) {
    const query = e.detail.value
    this.setData({ searchQuery: query, isSearching: !!query.trim() })
    if (query.trim()) {
      this.doSearch(query.trim())
    } else {
      this.setData({ searchResults: [] })
    }
  },

  onClearSearch() {
    this.setData({ searchQuery: '', searchResults: [], isSearching: false })
  },

  async doSearch(query: string) {
    try {
      const res: any = await request('GET', `/events/search?q=${encodeURIComponent(query)}`)
      if (res.code === 200) {
        const { memberMap } = this.data
        const results = res.data.map((e: any) => {
          const m = memberMap[e.creator_openid]
          return {
            ...e,
            creatorColor: m ? m.color : '#999',
            creatorAvatarText: m && (m.avatarUrl || m.nickName) ? (m.avatarUrl || m.nickName[0]) : '?',
            timeText: e.is_all_day ? '全天' : `${this.formatTime(e.start_time)} - ${this.formatTime(e.end_time)}`
          }
        })
        this.setData({ searchResults: results })
      }
    } catch (err) {
      console.error('搜索失败', err)
    }
  },

  onSearchResultTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/event-edit/event-edit?id=${id}&familyId=${this.data.family._id}`
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

  onToggleView(e: any) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.viewMode) return
    this.setData({ viewMode: mode }, () => {
      if (mode === 'week') {
        this.buildWeekView()
      }
    })
  },

  buildWeekView() {
    const { selectedDate } = this.data
    const d = new Date(selectedDate + 'T00:00:00')
    const dayOfWeek = d.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)

    const weekDays: any[] = []
    for (let i = 0; i < 7; i++) {
      const cd = new Date(monday)
      cd.setDate(monday.getDate() + i)
      const dateStr = this.formatDate(cd)
      weekDays.push({
        date: dateStr,
        dayNum: cd.getDate(),
        weekday: ['一','二','三','四','五','六','日'][i],
        isToday: dateStr === this.data.today,
        isSelected: dateStr === this.data.selectedDate
      })
    }

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const rangeText = `${monday.getMonth() + 1}.${monday.getDate()} - ${sunday.getMonth() + 1}.${sunday.getDate()}`

    this.setData({ weekDays, weekRangeText: rangeText }, () => {
      this.calcWeekEvents()
    })
  },

  calcWeekEvents() {
    const { events, weekDays, memberMap } = this.data
    const weekEventBlocks: any[] = []

    weekDays.forEach((day: any, dayIndex: number) => {
      const dayStart = new Date(day.date + 'T00:00:00').getTime()
      const dayEnd = new Date(day.date + 'T23:59:59').getTime()

      const dayEvents = events.filter((e: any) => {
        const s = new Date(e.start_time).getTime()
        const en = new Date(e.end_time).getTime()
        return s <= dayEnd && en >= dayStart
      })

      // 分离全天事件和定时事件
      const allDayEvents = dayEvents.filter((e: any) => e.is_all_day)
      const timedEvents = dayEvents.filter((e: any) => !e.is_all_day)

      // 全天事件显示为顶部小条
      allDayEvents.forEach((e: any) => {
        const m = memberMap[e.creator_openid]
        weekEventBlocks.push({
          _id: e._id || e.id,
          title: e.title,
          dayIndex,
          top: -44,
          height: 36,
          color: m ? m.color : '#999',
          left: 0,
          width: 100,
          isAllDay: true
        })
      })

      // 定时事件分配列解决重叠
      timedEvents.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

      const BLOCK_W = 88   // 固定宽度 88%
      const BLOCK_H = 4    // 固定高度 4rpx（2px）
      const items = timedEvents.map((e: any) => {
        const s = new Date(e.start_time)
        const en = new Date(e.end_time)
        const sm = Math.max(s.getHours() * 60 + s.getMinutes(), 360)
        const em = Math.min(en.getHours() * 60 + en.getMinutes(), 1440)
        return { e, sm, em }
      })

      const cols: any[][] = []
      items.forEach((it) => {
        let placed = false
        for (const col of cols) {
          const last = col[col.length - 1]
          if (it.sm >= last.em) {
            col.push(it)
            placed = true
            break
          }
        }
        if (!placed) cols.push([it])
      })

      cols.forEach((col, ci) => {
        col.forEach((it) => {
          const m = memberMap[it.e.creator_openid]
          weekEventBlocks.push({
            _id: it.e._id || it.e.id,
            title: it.e.title,
            dayIndex,
            top: (it.sm / 60 - 6) * 60,
            height: BLOCK_H,
            color: m ? m.color : '#999',
            left: 4 + ci * 2,
            width: BLOCK_W,
            isAllDay: false
          })
        })
      })
    })

    this.setData({ weekEvents: weekEventBlocks })
  },

  onPrevWeek() {
    const { selectedDate } = this.data
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    const newDate = this.formatDate(d)
    this.setData({
      selectedDate: newDate,
      weekdayText: this.getWeekdayText(d)
    }, () => {
      this.buildWeekView()
      this.loadDailyEvents(newDate)
    })
  },

  onNextWeek() {
    const { selectedDate } = this.data
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    const newDate = this.formatDate(d)
    this.setData({
      selectedDate: newDate,
      weekdayText: this.getWeekdayText(d)
    }, () => {
      this.buildWeekView()
      this.loadDailyEvents(newDate)
    })
  },

  onSelectWeekDay(e: any) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({
      selectedDate: date,
      weekdayText: this.getWeekdayText(new Date(date + 'T00:00:00'))
    }, () => {
      this.buildWeekView()
      this.loadDailyEvents(date)
    })
  },

  // onShareAppMessage() {
  //   const { family } = this.data
  //   return {
  //     title: family ? `${family.name}的家庭日历` : '家庭共享日历',
  //     path: '/pages/index/index'
  //   }
  // }
})
