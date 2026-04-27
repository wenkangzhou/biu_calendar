import { login, getConfig } from './utils/api'

export interface IAppOption {
  globalData: {
    userInfo?: any
    openid?: string
    family?: any
    memberMap?: Record<string, any>
    reviewMode?: boolean
  }
  initLogin?: () => Promise<void>
  loginPromise?: Promise<void>
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    openid: '',
    family: null,
    memberMap: {},
    reviewMode: true
  },

  onLaunch() {
    // 总是执行登录，确保 openid / userInfo / family 都就位
    this.loginPromise = this.initLogin!()
  },

  async initLogin() {
    try {
      const wxRes: any = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })

      if (!wxRes.code) {
        console.error('微信登录失败', wxRes)
        return
      }

      const res: any = await login(wxRes.code)
      if (res.code === 200) {
        this.globalData.openid = res.data.openid
        this.globalData.userInfo = res.data.user
        this.globalData.family = res.data.family
        wx.setStorageSync('openid', res.data.openid)

        if (res.data.family && res.data.family.members) {
          const map: Record<string, any> = {}
          res.data.family.members.forEach((m: any) => {
            map[m.openid] = m
          })
          this.globalData.memberMap = map
        }

        // 获取审核模式配置
        try {
          const cfg: any = await getConfig()
          if (cfg.code === 200) {
            this.globalData.reviewMode = cfg.data.reviewMode
            // 登录完成时主动更新 tabBar，避免首页 onShow 已执行过但 reviewMode 还未拿到
            const pages = getCurrentPages()
            if (pages.length > 0) {
              const page = pages[pages.length - 1] as any
              if (typeof page.getTabBar === 'function' && page.getTabBar()) {
                page.getTabBar().setData({ reviewMode: this.globalData.reviewMode })
              }
            }
          }
        } catch (e) {
          console.error('获取配置失败', e)
        }
      }
    } catch (err) {
      console.error('登录失败', err)
    }
  }
})
