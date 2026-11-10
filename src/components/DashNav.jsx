import SiteHeader from './SiteHeader.jsx'

export default function DashNav({ current, title, subtitle }) {
  return (
    <>
      <SiteHeader current={current} />
      <section className="page-hero" style={{ viewTransitionName: 'page-hero' }}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
    </>
  )
}
