// 淘宝适配器：客户端反爬极强，诚实降级
export async function parse(text, url) {
  return {
    platform: 'taobao',
    type: 'video',
    title: '淘宝内容',
    cover: '',
    mediaUrl: null,
    images: [],
    desc: '',
    unsupported: true,
  };
}
