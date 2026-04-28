const app = getApp<any>()

const ALL_TABS = [
  { pagePath: '/pages/index/index', text: '日历' },
  { pagePath: '/pages/family/family', text: '家人' },
  { pagePath: '/pages/profile/profile', text: '我的' }
]

Component({
  data: {
    selected: 0,
    reviewMode: false,
    list: ALL_TABS
  },
  lifetimes: {
    attached() {
      this.setData({ reviewMode: app.globalData.reviewMode })
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
