import { UserOutlined } from '@ant-design/icons'
import Head from 'next/head'
import Link from 'next/link'

import { promptLogout, useUser } from './auth'
import { useStored } from './useStored'

export const HeaderBar = (): JSX.Element => {
  const { user } = useUser()
  const { election_id, election_title } = useStored()
  return (
    <div className="bg-gradient-to-r from-[#010b26] to-[#072054] text-white flex w-full justify-between">
      <section className="left">
        <Link href="/">
          <a className="logo">SIV</a>
        </Link>
      </section>

      <section className="right">
        <div className="flex">
          {election_id && (
            <>
              <Head>
                <title key="title">SIV: Manage {election_title}</title>
              </Head>
              <Link href="/admin">
                <a
                  className="back-btn"
                  onClick={() => {
                    const el = document.getElementById('main-content')
                    if (el) el.scrollTop = 0
                  }}
                >
                  ←
                </a>
              </Link>
              <div className="text-[14px]">
                Managing: <i>{election_title}</i>
                <div className="text-[10px] opacity-80 mt-1">ID: {election_id}</div>
              </div>
            </>
          )}
        </div>

        <div className="login-status" onClick={promptLogout}>
          <UserOutlined />
          &nbsp; {user.name}
        </div>
      </section>
      <style jsx>{`
        .left {
          min-width: 200px;
          padding: 1rem 0;
        }

        @media (max-width: 650px) {
          .left {
            min-width: 80px;
          }
        }

        .logo {
          font-size: 24px;
          font-weight: 700;
          color: #ddd;
          padding: 1rem;
        }

        .logo:hover {
          color: #fff;
          text-decoration: none;
        }

        .right {
          width: 100%;
          padding: 1rem 0rem;

          display: flex;

          justify-content: space-between;
        }

        .back-btn {
          margin-right: 18px;
          color: #fff;
          opacity: 0.4;
          border-radius: 100px;
          width: 30px;
          height: 30px;
          line-height: 30px;
          font-weight: 700;
          text-align: center;
        }

        .back-btn:hover {
          opacity: 0.9;
          background: #fff2;
          cursor: pointer;
          text-decoration: none;
        }

        .login-status {
          font-size: 16px;
          padding: 3px 10px;
          border-radius: 4px;

          display: flex;
          align-items: center;

          margin-right: 1rem;
        }

        .login-status:hover {
          background: #fff2;
          cursor: pointer;
        }

        /* When Sidebar disappears */
        @media (max-width: 500px) {
          .right {
            width: initial;
            position: relative;
            right: 2rem;
          }

          .back-btn {
            margin-right: 10px;
          }

          .login-status {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
