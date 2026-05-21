import { supabase } from './supabase'
import { getStoredUser } from '../services/api'

export const MONTHLY_PLAN_PAYMENTS_TABLE = 'monthly_plan_payments'
export const MONTHLY_PLAN_RECEIPTS_BUCKET = 'receipts'

function readGarageId() {
  if (typeof window === 'undefined') {
    return String(getStoredUser()?.garage_id || '').trim()
  }

  return (
    String(window.localStorage.getItem('smartpark_garage_id') || '').trim() ||
    String(getStoredUser()?.garage_id || '').trim()
  )
}

function normalizeRows(data) {
  return Array.isArray(data) ? data : []
}

function getFileExtension(file) {
  const filename = String(file?.name || '').trim()
  if (!filename.includes('.')) return 'bin'
  const raw = filename.split('.').pop() || 'bin'
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
}

export function buildLatestPaymentMap(rows = []) {
  return rows.reduce((acc, row) => {
    const planId = String(row?.plan_id || '').trim()
    if (!planId || acc[planId]) return acc
    acc[planId] = row
    return acc
  }, {})
}

export async function listMonthlyPlanPayments({ garageId, planIds = [] } = {}) {
  const resolvedGarageId = String(garageId || readGarageId()).trim()
  let query = supabase
    .from(MONTHLY_PLAN_PAYMENTS_TABLE)
    .select('*')
    .order('paid_at', { ascending: false })

  if (resolvedGarageId) {
    query = query.eq('garage_id', resolvedGarageId)
  }

  const cleanedPlanIds = Array.isArray(planIds)
    ? [...new Set(planIds.map((value) => String(value || '').trim()).filter(Boolean))]
    : []

  if (cleanedPlanIds.length) {
    query = query.in('plan_id', cleanedPlanIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message || 'No se pudieron cargar los pagos mensuales.')
  return normalizeRows(data)
}

export async function createMonthlyPlanPayment(payload) {
  const { data, error } = await supabase
    .from(MONTHLY_PLAN_PAYMENTS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'No se pudo guardar el pago mensual.')
  return data
}

export async function deleteMonthlyPlanPayment(paymentId) {
  if (!paymentId) return

  const { error } = await supabase
    .from(MONTHLY_PLAN_PAYMENTS_TABLE)
    .delete()
    .eq('id', paymentId)

  if (error) throw new Error(error.message || 'No se pudo revertir el pago mensual.')
}

export async function uploadMonthlyPaymentReceipt({ garageId, planId, reference, file }) {
  if (!file) {
    return { publicUrl: null, objectPath: null }
  }

  const resolvedGarageId = String(garageId || readGarageId() || 'general').trim()
  const resolvedPlanId = String(planId || 'plan').trim()
  const resolvedReference = String(reference || Date.now()).trim()
  const fileExtension = getFileExtension(file)
  const objectPath = `${resolvedGarageId}/${resolvedPlanId}/${resolvedReference}.${fileExtension}`

  const { error } = await supabase.storage
    .from(MONTHLY_PLAN_RECEIPTS_BUCKET)
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    })

  if (error) throw new Error(error.message || 'No se pudo subir el comprobante.')

  const { data } = supabase.storage
    .from(MONTHLY_PLAN_RECEIPTS_BUCKET)
    .getPublicUrl(objectPath)

  return {
    publicUrl: data?.publicUrl || null,
    objectPath,
  }
}

export async function deleteMonthlyPaymentReceipt(objectPath) {
  if (!objectPath) return

  const { error } = await supabase.storage
    .from(MONTHLY_PLAN_RECEIPTS_BUCKET)
    .remove([objectPath])

  if (error) throw new Error(error.message || 'No se pudo eliminar el comprobante.')
}
