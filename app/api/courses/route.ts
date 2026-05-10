import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

async function getPrismaUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.email) return null

  return prisma.user.upsert({
    where: { email: data.user.email },
    update: {},
    create: { email: data.user.email },
  })
}

export async function GET(request: Request) {
  const user = await getPrismaUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'

  const courses = await prisma.course.findMany({
    where: { userId: user.id, ...(all ? {} : { isArchived: false }) },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(courses)
}

export async function POST(request: Request) {
  const user = await getPrismaUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name: string = (body.name ?? '').trim()
  const code: string = (body.code ?? '').trim()

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const course = await prisma.course.create({
    data: {
      name,
      code: code || null,
      userId: user.id,
    },
  })

  return NextResponse.json(course, { status: 201 })
}
