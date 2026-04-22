Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '日历' },
      { pagePath: '/pages/family/family', text: '家人' },
      { pagePath: '/pages/profile/profile', text: '我的' }
    ]
  },
  methods: {
    switchTab(e: any) {
      const { index, path } = e.currentTarget.dataset
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    }
  }
})
