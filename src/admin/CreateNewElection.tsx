import router from 'next/router'
import { useRef, useState } from 'react'

import { api } from '../api-helper'
import { SaveButton } from './SaveButton'

export const CreateNewElection = () => {
  const [election_title, set_title] = useState('')
  const $input = useRef<HTMLInputElement>(null)
  const $saveBtn = useRef<HTMLAnchorElement>(null)

  return (
    <>
      <h2>Create New Ballot</h2>
      <label>Ballot Title:</label>

      <input
        className="w-full p-2 text-sm border border-gray-300 border-solid rounded"
        id="election-title"
        placeholder="Give your ballot a name your voters will recognize"
        value={election_title}
        onChange={(event) => set_title(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            $input.current?.blur()
            $saveBtn.current?.click()
          }
        }}
      />
      <SaveButton
        id="election-title-save"
        onPress={async () => {
          const response = await api('create-election', { election_title })
          if (response.status !== 201) throw await response.json()

          // Set election_id in URL
          const { election_id } = await response.json()
          router.push(`${window.location.origin}/admin/${election_id}/ballot-design`)
        }}
      />
    </>
  )
}
