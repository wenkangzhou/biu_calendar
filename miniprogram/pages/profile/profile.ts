import { getFamily, getToken, getEventStats } from '../../utils/api'

const app = getApp<any>()

Page({
  data: {
    user: null as any,
    family: null as any,
    hasFamily: false,
    myColor: '#7DD3C0',
    stats: {
      total: 0,
      today: 0,
      todo: 0
    }
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    if (!getToken() && app.loginPromise) {
      await app.loginPromise
    }
    const openid = app.globalData.openid || wx.getStorageSync('openid')
    const memberMap = app.globalData.memberMap || {}
    const myMember = memberMap[openid]
    this.setData({
      user: app.globalData.userInfo,
      myColor: myMember ? myMember.color : '#7DD3C0'
    })
    await this.loadFamily()
    this.calcStats()
  },

  async loadFamily() {
    try {
      const res: any = await getFamily()
      if (res.code === 200) {
        app.globalData.family = res.data
        this.setData({ family: res.data, hasFamily: true })
      } else {
        this.setData({ hasFamily: false })
      }
    } catch (err) {
      this.setData({ hasFamily: false })
    }
  },

  async calcStats() {
    try {
      const res: any = await getEventStats()
      if (res.code === 200) {
        this.setData({ stats: res.data })
      }
    } catch (err) {
      console.error('加载统计数据失败', err)
    }
  },

  onEditProfile() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  onGoFamily() {
    wx.switchTab({ url: '/pages/family/family' })
  },

  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '已清理', icon: 'success' })
          setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 800)
        }
      }
    })
  },

  onSubscribe() {
    wx.showModal({
      title: '日程提醒',
      content: '创建日程时开启「日程提醒」开关，保存时会自动请求微信授权。每次授权仅对应当前日程的一条提醒消息。',
      showCancel: false
    })
  },

  // onShareAppMessage() {
  //   return {
  //     title: '家庭共享日历',
  //     path: '/pages/index/index'
  //   }
  // }
})
