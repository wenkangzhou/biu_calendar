import { getFamily, getToken, getEventStats } from '../../utils/api'

const app = getApp<any>()

Page({
  data: {
    user: null as any,
    family: null as any,
    hasFamily: false,
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
    this.setData({
      user: app.globalData.userInfo
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
    wx.showToast({ title: '订阅功能开发中', icon: 'none' })
  },

  onFontSize() {
    wx.showToast({ title: '字体设置开发中', icon: 'none' })
  },

  onNotification() {
    wx.showToast({ title: '消息通知开发中', icon: 'none' })
  },

  onShareAppMessage() {
    return {
      title: '家庭共享日历',
      path: '/pages/index/index'
    }
  }
})
