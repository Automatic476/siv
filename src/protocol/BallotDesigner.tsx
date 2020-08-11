export const BallotDesigner = () => (
  <>
    <textarea
      disabled
      value={`[{
  question: 'Who should be the next mayor?',
  choices: [
    'Angela Alioto',
    'London Breed',
    'Mark Leno',
    'Jane Kim',
]}]`}
    />

    <style jsx>{`
      textarea {
        font-size: 13px;
        height: 180px;
        max-width: 400px;
        padding: 10px;
        resize: none;
        width: 100%;
      }
    `}</style>
  </>
)
