import { HttpError, json, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

const MAX = 2_500_000
const ID = /^ORI-[A-Z0-9]+(-[A-Z0-9]+)+$/

// Trust the file's own signature, not the Content-Type header
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

// Upload one product photo: POST /api/admin/media?product=ORI-… with the image as the raw body
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const product = new URL(request.url).searchParams.get('product') ?? ''
  if (!ID.test(product)) throw new HttpError(400, 'invalid_input')
  if (Number(request.headers.get('content-length') ?? 0) > MAX) throw new HttpError(413, 'too_large')
  const data = Buffer.from(await request.arrayBuffer())
  if (!data.length || data.length > MAX) throw new HttpError(data.length ? 413 : 400, data.length ? 'too_large' : 'invalid_input')
  const mime = sniff(data)
  if (!mime) throw new HttpError(415, 'not_an_image')
  const [{ r }] = await sql`select api_admin_media_add(${token}, ${product}, ${mime}, ${data}) as r`
  return json(r, 201)
})
