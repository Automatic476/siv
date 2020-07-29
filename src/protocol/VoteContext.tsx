import { map, mapValues, merge } from 'lodash'
import { createContext, useContext, useMemo, useReducer } from 'react'

import { encode } from './crypto/encode'
import encrypt from './crypto/encrypt'
import pickRandomInteger from './crypto/pick-random-integer'
import { Big, big } from './crypto/types'
import { candidates, public_key, voters } from './election-parameters'

const initState = {
  encrypted: {},
  otherSubmittedVotes: voters
    .slice(1)
    .map(({ token }) => ({ random: [...new Array(4)].map(() => pickRandomInteger(public_key.modulo)), token })),
  plaintext: { secret: '', vote_for_mayor: candidates[1] },
  randomizer: {},
}

function reducer(prev: State, payload: Payload) {
  const newState = merge({ ...prev }, { plaintext: payload })

  // Encrypt values
  const randomizer: Map = {}
  const encrypted = mapValues(newState.plaintext, (value, key) => {
    const random = pickRandomInteger(public_key.modulo)
    randomizer[key] = random.toString()
    const cipher = encrypt(public_key, random, big(encode(value)))

    return `{ ${map(cipher, (value: Big, key) => `${key}: ${value.toString()}`).join(', ')} }`
  })

  return merge(newState, { encrypted, randomizer })
}

// Boilerplate to be easier to use

type Map = Record<string, string>
type State = {
  encrypted: Map
  otherSubmittedVotes: { random: Big[]; token: string }[]
  plaintext: Map
  randomizer: Map
}

type Payload = Map | { yOffset: Map }

const Context = createContext<{ dispatch: (payload: Payload) => void; state: State }>({
  dispatch: (payload: Payload) => void payload,
  state: initState,
})

export function VoteContextProvider({ children }: { children: JSX.Element }) {
  const [state, dispatch] = useReducer(reducer, initState)
  const memoized = useMemo(() => ({ dispatch, state }), [dispatch, state])

  return <Context.Provider value={memoized}>{children}</Context.Provider>
}

export const useVoteContext = () => useContext(Context)
