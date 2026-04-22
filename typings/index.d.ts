/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: any,
    openid?: string,
    family?: any,
    memberMap?: Record<string, any>
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
  initLogin?: () => Promise<void>
  loginPromise?: Promise<void>
}
