import { GlobalOutlined, LinkOutlined } from '@ant-design/icons'
import { BoxProps, NoSsr, TextField, TextFieldProps } from '@material-ui/core'
import { useCallback, useState } from 'react'

import { FormSubmitBtns } from './FormSubmitBtns'

export const IfYesForm = ({ id }: { id?: string }) => {
  const [saved, setSaved] = useState(false)
  const [showBottom, setShowBottom] = useState(false)
  // const [error, setError] = useState('')
  const [contentPreferences, setContentPreferences] = useState<Record<string, boolean>>({})
  const [stayUpdated, setStayUpdated] = useState(false)

  // DRY-up TextField
  const Field = useCallback(
    (props: TextFieldProps) => (
      <NoSsr>
        <TextField
          size="small"
          variant="outlined"
          onChange={() => setSaved(false)}
          {...props}
          id={props.id}
          style={{ ...props.style }}
        />
      </NoSsr>
    ),
    [],
  )

  return (
    <form autoComplete="off">
      <Row>
        <Field fullWidth id="name" label="Your Name" />
      </Row>
      <Row style={{ marginBottom: 0 }}>
        <Field fullWidth id="email" label="Your Email" />
      </Row>
      <Row style={{ marginTop: 10 }}>
        <label>
          <input readOnly checked={stayUpdated} type="checkbox" onClick={() => setStayUpdated(!stayUpdated)} />
          Keep me updated
        </label>
      </Row>
      <Row>
        <Field fullWidth id="city" label="City" style={{ marginRight: 30 }} />

        <Field fullWidth id="state" label="State" style={{ marginRight: 30 }} />

        <Field fullWidth id="country" label="Country" style={{ marginRight: 30 }} />

        <Field fullWidth id="zip" label="ZIP" style={{ maxWidth: 80 }} />
      </Row>
      <Row>
        <Field fullWidth multiline id="reason" label="Reason / Note" rows={4} />
      </Row>
      <Row style={{ marginBottom: 0 }}>
        <Field
          fullWidth
          multiline
          id="topics"
          label="Questions or topics you'd like more information about "
          rows={4}
        />
      </Row>
      <div className="content-preference">
        Preference:
        {['Video', 'Audio', 'Text'].map((label) => (
          <label key={label}>
            <input
              readOnly
              checked={!!contentPreferences[label]}
              type="checkbox"
              onClick={() => setContentPreferences({ ...contentPreferences, [label]: !contentPreferences[label] })}
            />
            {label}
          </label>
        ))}
      </div>

      <FormSubmitBtns
        fields={{ contentPreferences, id, stayUpdated }}
        formFieldNames={['name', 'email', 'city', 'state', 'country', 'zip', 'reason', 'topics']}
        {...{ saved, setSaved, setShowBottom }}
      />

      {/* Bottom part */}
      {showBottom && (
        <>
          <h2>Thank you for your time!</h2>

          <div className="bottom-content">
            Share this question with your friends
            <br /> More <i>Yes</i> = Faster availability
            <br />
            <div className="icons">
              <a href="/somewhere">
                <LinkOutlined style={{ fontSize: 25, marginTop: 30 }} />
                <span>Link</span>
              </a>
              <a href="/">
                <GlobalOutlined style={{ fontSize: 25, marginTop: 30 }} />
                <span>Homepage</span>
              </a>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .error {
          color: red;
          position: relative;
          bottom: 6rem;
        }
        .content-preference {
          display: flex;
          margin-top: 10px;
          margin-bottom: 1.5rem;
        }

        .content-preference label {
          display: flex;
          font-size: 15px;
          align-items: center;
          margin-left: 1.5rem;
        }

        input[type='checkbox'] {
          margin-right: 15px;
          transform: scale(1.2);
        }

        h2 {
          text-align: center;
        }
        .bottom-content {
          text-align: center;
        }
        .icons {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .icons a,
        .icons a span {
          display: block;
          color: darkblue;
        }

        .icons > a:not(:last-child) {
          margin-right: 3rem;
        }
      `}</style>
    </form>
  )
}

const Row = (props: BoxProps) => (
  <div
    {...props}
    style={{
      display: 'flex',
      margin: '1.5rem 0',
      ...props.style,
    }}
  />
)
