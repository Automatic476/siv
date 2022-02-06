/* eslint-disable no-bitwise, no-continue */
import { randomBytes } from 'crypto'

import { CURVE, RistrettoPoint as RP, utils } from '@noble/ed25519'

import { pick_random_bigint } from './pick-random-bigint'

export { RistrettoPoint as RP } from '@noble/ed25519'

export const mod = (a: bigint, b = CURVE.l) => utils.mod(a, b)
export const invert = (a: bigint, b = CURVE.l) => utils.invert(a, b)
export const G = RP.BASE

/** We have 32 bytes to start,
minus the first one for storing length,
minus one more for min random entropy needed to find a valid point. */
export const maxLength = 32 - 2

/** Embed binary data into a valid Ristretto255 point */
function embed(data: Uint8Array): RP {
  const { length } = data
  if (length > maxLength) throw new Error(`Too much data to embed: ${length} > ${maxLength}`)

  const maxAttempts = 1000
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Fill w/ random bytes
    const bytes = new Uint8Array(randomBytes(32))

    // Store the data's length in the first byte
    // BUT Ristretto needs the first bit to always be off
    // so shift it left by one bit, then undo later
    bytes[0] = length << 1

    bytes.set(data, 1) // Copy in data

    // Now check if it's a valid point
    let point: RP
    try {
      point = RP.fromHex(bytes)
    } catch {
      continue // Invalid point, retry
    }

    // console.log(`Attempts needed to embed: ${attempt + 1}`)

    return point // Success
  }

  throw new Error(`Ran out of embedding attempts: ${maxAttempts}`)
}

/** Embed string data into a Ristretto255 point */
export const stringToPoint = (message: string): RP => embed(new TextEncoder().encode(message))

/** Extract embedded data from a Ristretto255 point */
function extract(point: RP): Uint8Array {
  const bytes = point.toRawBytes()
  const length = bytes[0] >> 1 // Extract length from 1st byte, undoing embed()'s left shift
  if (length > maxLength) throw new Error(`extract length ${length} > maxLength ${maxLength}`)
  return bytes.subarray(1, 1 + length)
}

/** Extract string data from a Ristretto255 point */
export const pointToString = (point: RP): string => new TextDecoder().decode(extract(point))

/** Give a cryptographically random bigint less than Curve25519's l */
export const random_bigint = (): bigint => pick_random_bigint(CURVE.l)

/** Sum up an array of bigints in mod */
export const sum_bigints = (bigs: bigint[], modulo = CURVE.l): bigint =>
  bigs.reduce((memo, term) => mod(memo + term, modulo))

/** Sum up an array of RistrettoPoints */
export const sum_points = (points: RP[]): RP => points.reduce((memo, term) => memo.add(term))
