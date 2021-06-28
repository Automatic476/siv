import Link from 'next/link'
import { useRouter } from 'next/router'

export const Sidebar = () => {
  const { section } = useRouter().query

  const sections = ['Overview', 'Trustees', 'Ballot Design', 'Voters']
  const urled = (s: string) => s.toLowerCase().replaceAll(' ', '-')

  return (
    <div className="sidebar">
      <main>
        <div>
          <Link href="/admin">
            <a className="all-elections">← All Elections</a>
          </Link>
        </div>

        <>
          <label>Election Management</label>
          {sections.map((s) => (
            <Link href={`./${urled(s)}`} key={s}>
              <a className={urled(s) === section ? 'current' : ''}>{s}</a>
            </Link>
          ))}
        </>
        <>
          <label>Public Pages</label>
          <Link href="/voters">
            <a>Cast Vote</a>
          </Link>
          <Link href="/voters">
            <a>Election Status</a>
          </Link>
        </>
      </main>

      <div className="bottom">
        <label>Support</label>
        <Link href="/voters">
          <a>Protocol Overview</a>
        </Link>
        <Link href="/voters">
          <a>Get Help</a>
        </Link>
      </div>

      <style jsx>{`
        .sidebar {
          min-width: 215px;
          padding: 0px 13px;
          background-color: #eee;
          padding-top: 1rem;

          height: calc(100vh - 66px);

          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* Hide for small screens */
        @media (max-width: 1030px) {
          .sidebar {
            display: none;
          }
        }

        label {
          display: block;
          margin-top: 30px;
          opacity: 0.5;
        }

        a:not(.all-elections) {
          display: block;
          padding: 3px 8px;
          border-radius: 5px;
          margin: 4px 0;
          font-weight: 500;
          cursor: pointer;
          color: #000c;
          transition: 0.05s color linear;
          font-size: 16px;
        }

        a:hover:not(.all-elections) {
          color: #000;
          background-color: #ffffff58;
          text-decoration: none;
        }

        a.current {
          background-color: #fff;
        }

        .bottom {
          padding-bottom: 15px;
        }
      `}</style>
    </div>
  )
}
