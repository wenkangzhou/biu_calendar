const app = getApp<any>()

const ALL_TABS = [
  { pagePath: '/pages/index/index', text: '日历' },
  { pagePath: '/pages/family/family', text: '家人' },
  { pagePath: '/pages/profile/profile', text: '我的' }
]

Component({
  data: {
    selected: 0,
    reviewMode: true,
    list: ALL_TABS
  },
  lifetimes: {
    attached() {
      const reviewMode = app.globalData.reviewMode || false
      // 根据当前页面路径匹配 selected，避免 index 错位
      const pages = getCurrentPages()
      const currentPath = pages.length > 0 ? '/' + pages[pages.length - 1].route : ''
      const idx = ALL_TABS.findIndex(t => t.pagePath === currentPath)
      this.setData({
        reviewMode,
        selected: idx >= 0 ? idx : 0
      })
    }
  },
  methods: {
    switchTab(e: any) {
      const { path } = e.currentTarget.dataset
      // 通过路径在固定 list 中查找 index，不依赖渲染顺序
      const idx = ALL_TABS.findIndex(t => t.pagePath === path)
      if (idx >= 0) {
        this.setData({ selected: idx })
      }
      wx.switchTab({ url: path })
    }
  }
})
