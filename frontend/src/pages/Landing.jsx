import { useNavigate } from 'react-router-dom'
import './landing.css'

const stats = [
  {
    label: 'Ahorro de tiempo',
    value: '30%',
    meta: '+15% vs promedio',
    desc: 'Optimización media en los procesos de entrada y salida del garaje.',
    icon: 'speed',
  },
  {
    label: 'Garajes activos',
    value: '500+',
    meta: '+20% este mes',
    desc: 'Operadores y administradores ya confían en SmartPark para controlar sus espacios.',
    icon: 'groups',
  },
  {
    label: 'Satisfacción',
    value: '4.9/5',
    meta: 'Rating',
    desc: 'Basado en reseñas verificadas de usuarios.',
    icon: 'star',
  },
]

const features = [
  {
    icon: 'bolt',
    title: 'Registro rápido',
    body: 'Registra entradas y salidas en segundos con una interfaz pensada para operar sin fricciones.',
    bullets: ['Control de accesos', 'Operación en tiempo real'],
  },
  {
    icon: 'garage',
    title: 'Control total de espacios',
    body: 'Monitorea la ocupación, los espacios disponibles y el flujo de vehículos desde un solo panel.',
    bullets: ['Mapa del garaje', 'Asignación de espacios'],
  },
  {
    icon: 'receipt_long',
    title: 'Cobro automatizado',
    body: 'Calcula permanencia, genera cobros por tiempo y consulta Reports diarios sin hojas manuales.',
    bullets: ['Tarifas por hora', 'Reports de ingresos'],
  },
]

export default function Landing() {
  const navigate = useNavigate()

  const scrollTo = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="landing-shell">
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="logo-mark">
            <img className="logo-mark__image" src="/images/logo-smartpark.png" alt="Logo de SmartPark" />
          </div>
          <div>
            <p className="logo-title">SmartPark</p>
            <span className="logo-sub">CONTROL TOTAL</span>
          </div>
        </div>
        <div className="landing-links">
          <button type="button" className="link-text" onClick={() => scrollTo('features')}>
            Funcionalidades
          </button>
          <button type="button" className="link-text" onClick={() => scrollTo('stats')}>
            Impacto
          </button>
          <button type="button" className="link-text" onClick={() => scrollTo('cta')}>
            Precios
          </button>
        </div>
        <div className="landing-actions">
          <button className="nav-link" onClick={() => navigate('/login?force=1')} type="button">
            Iniciar sesión
          </button>
          <button className="primary-btn" onClick={() => navigate('/register?force=1')} type="button">
            Prueba gratis
          </button>
        </div>
      </nav>

      <header className="landing-hero">
        <video className="hero-video" autoPlay muted loop playsInline poster="/images/hero-fallback.jpg">
          <source src="/videos/background-loop.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-glow glow-top" />
        <div className="hero-glow glow-bottom" />
        <div className="hero-content">
          <div className="hero-pill">Plataforma SaaS de Próxima Generación</div>
          <h1>
            Gestiona tu garaje y estacionamiento con <span className="hero-gradient">Inteligencia</span>
          </h1>
          <p>
            Optimiza la ocupación, controla accesos, registra movimientos y consulta ingresos en una sola plataforma
            diseñada para la operación diaria de tu garaje.
          </p>
          <div className="hero-buttons">
            <button className="primary-btn" onClick={() => navigate('/login?force=1')} type="button">
              Iniciar sesión
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                window.location.href = 'mailto:contacto@smartpark.com?subject=Quiero una demo'
              }}
              type="button"
            >
              Ver demo
            </button>
          </div>
        </div>
      </header>

      <section className="stats-section" id="stats">
        {stats.map((item) => (
          <article className="stat-card" key={item.label}>
            <div className="stat-card__header">
              <span className="material-symbols-outlined text-accent">{item.icon}</span>
              <p>{item.label}</p>
            </div>
            <div className="stat-card__main">
              <strong>{item.value}</strong>
              <span>{item.meta}</span>
            </div>
            <p className="stat-card__desc">{item.desc}</p>
          </article>
        ))}
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <p className="hero-pill">Soluciones inteligentes</p>
          <h2>
            Soluciones <span className="hero-gradient">inteligentes</span> para tu garaje
          </h2>
          <p> 
            Diseñamos herramientas claras y rápidas para controlar vehículos, espacios disponibles y cobros por tiempo
            sin complicaciones operativas.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon">
                <span className="material-symbols-outlined">{feature.icon}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <ul>
                {feature.bullets.map((item) => (
                  <li key={item}>
                    <span className="material-symbols-outlined check-icon">check_circle</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-section" id="cta">
        <div className="cta-card">
          <h2>Listo para digitalizar tu garaje hoy mismo?</h2>
          <p>Unete a los operadores que ya controlan accesos, ocupacion y cobros diarios con SmartPark.</p>
          <div className="hero-buttons">
            <button className="primary-btn" onClick={() => navigate('/register')} type="button">
              Empezar ahora
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                window.location.href = 'mailto:contacto@smartpark.com?subject=Quiero hablar'
              }}
              type="button"
            >
              Hablar con un experto
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <h3>SmartPark</h3>
            <p>La solucion definitiva para la gestion moderna de garajes y estacionamientos.</p>
            <div className="footer-icons">
              <a href="https://smartpark.com" target="_blank" rel="noreferrer">
                <span className="material-symbols-outlined">public</span>
              </a>
              <a href="mailto:contacto@smartpark.com">
                <span className="material-symbols-outlined">mail</span>
              </a>
              <a href="tel:+1800123456">
                <span className="material-symbols-outlined">phone</span>
              </a>
            </div>
          </div>
          <div>
            <h4>Producto</h4>
            <ul>
              <li>
                <a href="#features">Funcionalidades</a>
              </li>
              <li>
                <a href="#features">Integraciones</a>
              </li>
              <li>
                <a href="#features">Seguridad</a>
              </li>
              <li>
                <a href="#features">Hoja de ruta</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Empresa</h4>
            <ul>
              <li>
                <a href="#stats">Sobre nosotros</a>
              </li>
              <li>
                <a href="#stats">Blog</a>
              </li>
              <li>
                <a href="#cta">Contacto</a>
              </li>
              <li>
                <a href="#cta">Terminos y privacidad</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2024 SmartPark Software. Todos los derechos reservados.</p>
          <div className="footer-links">
            <a href="#cta">Privacidad</a>
            <a href="#cta">Cookies</a>
            <a href="#cta">Aviso legal</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

