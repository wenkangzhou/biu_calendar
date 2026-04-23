/**
 * HTTP API 封装（替代云开发）
 */

const API_BASE = 'http://localhost:3000/api' // 本地
// const API_BASE = 'https://biu-api.yiquwei.com/api' // 线上

function getToken(): string {
  return wx.getStorageSync('token') || ''
}

function saveToken(token: string) {
  wx.setStorageSync('token', token)
}

function removeToken() {
  wx.removeStorageSync('token')
}

function request<T = any>(method: string, url: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + url,
      method: method as any,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data
          if (body && body.code !== undefined && body.code !== 200) {
            reject(new Error(body.msg || '请求失败'))
          } else {
            resolve(body)
          }
        } else if (res.statusCode === 401) {
          removeToken()
          reject(new Error('登录已过期，请重新进入小程序'))
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err: any) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

// 登录相关
export async function login(code: string, userInfo?: any) {
  const res: any = await request('POST', '/auth/login', {
    code,
    nickName: userInfo?.nickName || '',
    avatarUrl: userInfo?.avatarUrl || ''
  })
  if (res.data?.token) {
    saveToken(res.data.token)
  }
  return res
}

// 家庭相关
export const getFamily = () => request('GET', '/family')
export const createFamily = (data: any) => request('POST', '/family', data)
export const joinFamily = (data: any) => request('POST', '/family/join', data)
export const refreshInviteCode = (data: { familyId: string }) => request('POST', '/family/refresh-code', data)
export const leaveFamily = (data: { familyId: string }) => request('POST', '/family/leave', data)

// 日程相关
export const getMonthlyEvents = (_familyId: string, year: number, month: number) =>
  request('GET', `/events?year=${year}&month=${month}`)

export const getDailyEvents = (_familyId: string, date: string) =>
  request('GET', `/events?date=${date}`)

export const getEvent = (eventId: string) => request('GET', `/events/${eventId}`)
export const createEvent = (data: any) => request('POST', '/events', data)
export const updateEvent = (eventId: string, data: any) => request('PUT', `/events/${eventId}`, data)
export const deleteEvent = (eventId: string) => request('DELETE', `/events/${eventId}`)

// 用户相关
export const updateUser = (data: { nickName?: string; avatarUrl?: string }) =>
  request('PUT', '/users', data)

// 导出 token 工具
export { getToken, saveToken, removeToken }
