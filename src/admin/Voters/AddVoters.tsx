import { useState } from 'react'

import { api } from '../../api-helper'
import { SaveButton } from '../SaveButton'
import { revalidate, useStored } from '../useStored'
import { ExistingVoters } from './ExistingVoters'
import { MultilineInput } from './MultilineInput'
import { RequestEsignatures } from './RequestEsignatures'

export const AddVoters = () => {
  const [new_voters, set_new_voters] = useState('')
  const { election_id } = useStored()

  return (
    <div className="max-w-2xl">
      <h2 className="hidden sm:block">Voters</h2>
      <h4>Add new voters by email address:</h4>
      <MultilineInput state={new_voters} update={set_new_voters} />

      {/* Show save button if there are new voters to add */}
      {new_voters === '' ? (
        <div style={{ height: 74 }} />
      ) : (
        <SaveButton
          onPress={async () => {
            const response = await api(`election/${election_id}/admin/add-voters`, {
              new_voters: new_voters.split('\n').map((s) => s.trim().toLowerCase()),
            })

            if (response.status === 201) {
              revalidate(election_id)
              set_new_voters('')
            } else {
              throw await response.json()
            }
          }}
        />
      )}
      <RequestEsignatures />
      <ExistingVoters />
    </div>
  )
}
