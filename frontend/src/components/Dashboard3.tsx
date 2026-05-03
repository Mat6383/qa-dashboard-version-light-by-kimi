import React from 'react';
import { ShieldAlert, ShieldCheck, Activity, Database, CheckCircle, Bug } from 'lucide-react';

const DEFAULT_RATES = {
  escapeRate: 0,
  detectionRate: 0,
  bugsInProd: 0,
  bugsInTest: 0,
  totalBugs: 0,
  preprodMilestone: 'N/A',
  prodMilestone: 'N/A',
  message: 'Données non disponibles',
};

const Dashboard3 = ({ metrics, project, isDark = false, useBusiness = true }) => {
  if (!metrics || !project) {
    return (
      <div className="tv-loading">
        <Activity size={48} className="spinner" />
        <h2>Chargement des données ISTQB...</h2>
      </div>
    );
  }

  const rates = metrics.qualityRates || DEFAULT_RATES;

  const escapeOk = rates.escapeRate < 5;
  const ddpOk = rates.detectionRate > 95;

  return (
    <div className={`tv-dashboard ${isDark ? 'tv-dark-theme' : ''}`} style={{ padding: '2rem' }}>
      <header className="tv-header" style={{ marginBottom: '2rem' }}>
        <div className="tv-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ShieldCheck size={48} color="var(--primary-color)" />
          <div>
            <h1 style={{ margin: 0, color: 'var(--text-color)' }}>
              {useBusiness ? 'Métrique de Qualité (ISTQB)' : 'Quality Rates'}
            </h1>
            <h2 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 400 }}>
              {project.name}
            </h2>
          </div>
        </div>
        <div className="tv-time" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-color)' }}>
          {new Date().toLocaleTimeString('fr-FR')}
        </div>
      </header>

      {rates.message && rates.totalBugs === 0 ? (
        <div
          className="alert-box"
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
            color: 'var(--text-color)',
          }}
        >
          <ShieldAlert size={48} color="#F59E0B" style={{ marginBottom: '1rem' }} />
          <h3>Information</h3>
          <p style={{ color: 'var(--text-muted)' }}>{rates.message}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Escape Rate Card */}
          <div
            className="metric-card tv-card"
            style={{
              backgroundColor: 'var(--card-bg)',
              padding: '1.5rem',
              borderRadius: '16px',
              border: `2px solid ${escapeOk ? 'var(--text-success)' : 'var(--text-danger)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              borderLeftWidth: '12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
              <ShieldAlert size={120} color={escapeOk ? 'var(--text-success)' : 'var(--text-danger)'} />
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                color: 'var(--text-color)',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                zIndex: 1,
                fontWeight: 700,
              }}
            >
              <ShieldAlert size={24} color={escapeOk ? 'var(--text-success)' : 'var(--text-danger)'} />
              Taux d&apos;Échappement
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', zIndex: 1 }}>
              <div
                style={{
                  fontSize: '4rem',
                  fontWeight: 800,
                  color: escapeOk ? 'var(--text-success)' : 'var(--text-danger)',
                  letterSpacing: '-2px',
                }}
              >
                {rates.escapeRate}%
              </div>
              <span style={{ fontSize: '1.5rem', color: escapeOk ? 'var(--text-success)' : 'var(--text-danger)' }}>
                {escapeOk ? '▼' : '▲'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', zIndex: 1 }}>
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  backgroundColor: escapeOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: escapeOk ? 'var(--text-success)' : 'var(--text-danger)',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: `1px solid ${escapeOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                Cible: &lt; 5%
              </span>
            </div>
            <div
              style={{
                marginTop: '1.25rem',
                width: '90%',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-color)',
                borderRadius: '12px',
                textAlign: 'center',
                color: 'var(--text-color)',
                zIndex: 1,
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{rates.bugsInProd}</div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}
              >
                {useBusiness ? 'bugs prod' : 'prod bugs'}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.25rem',
                }}
              >
                {useBusiness ? 'Jalon' : 'Milestone'}: <strong>{rates.prodMilestone}</strong>
              </div>
            </div>
          </div>

          {/* Detection Rate Card */}
          <div
            className="metric-card tv-card"
            style={{
              backgroundColor: 'var(--card-bg)',
              padding: '1.5rem',
              borderRadius: '16px',
              border: `2px solid ${ddpOk ? 'var(--text-success)' : 'var(--text-danger)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              borderLeftWidth: '12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
              <ShieldCheck size={120} color={ddpOk ? 'var(--text-success)' : 'var(--text-danger)'} />
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                color: 'var(--text-color)',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                zIndex: 1,
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={24} color={ddpOk ? 'var(--text-success)' : 'var(--text-danger)'} />
              Taux de Détection
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', zIndex: 1 }}>
              <div
                style={{
                  fontSize: '4rem',
                  fontWeight: 800,
                  color: ddpOk ? 'var(--text-success)' : 'var(--text-danger)',
                  letterSpacing: '-2px',
                }}
              >
                {rates.detectionRate}%
              </div>
              <span style={{ fontSize: '1.5rem', color: ddpOk ? 'var(--text-success)' : 'var(--text-danger)' }}>{ddpOk ? '▲' : '▼'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', zIndex: 1 }}>
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  backgroundColor: ddpOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: ddpOk ? 'var(--text-success)' : 'var(--text-danger)',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: `1px solid ${ddpOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                Cible: &gt; 95%
              </span>
            </div>
            <div
              style={{
                marginTop: '1.25rem',
                width: '90%',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-color)',
                borderRadius: '12px',
                textAlign: 'center',
                color: 'var(--text-color)',
                zIndex: 1,
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{rates.bugsInTest}</div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}
              >
                {useBusiness ? 'bugs test' : 'test bugs'}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.25rem',
                }}
              >
                {useBusiness ? 'Lié' : 'Linked'}: <strong>{rates.prodMilestone}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Détails explicatifs */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 2fr',
          gap: '2rem',
          color: 'var(--text-color)',
        }}
      >
        <div>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: 'var(--text-color)',
            }}
          >
            <Database size={20} />
            Définitions
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
            <strong>{useBusiness ? "Taux d'Échappement :" : 'Escape Rate :'}</strong> Mesure les défauts qui ont échappé
            aux tests et ont été découverts en production. Plus le taux est bas, meilleure est la qualité des tests.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <strong>{useBusiness ? 'Taux de Détection (DDP) :' : 'Detection Rate (DDP) :'}</strong> Mesure le
            pourcentage de défauts identifiés et corrigés avant la mise en production.
          </p>
        </div>

        <div style={{ paddingLeft: '2rem', borderLeft: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: 'var(--text-color)',
            }}
          >
            <Activity size={20} />
            Détails du calcul ({rates.totalBugs} bugs au total)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={16} color="#10B981" />
                Défauts test : {rates.bugsInTest}
              </span>
              <div
                style={{
                  flex: 1,
                  margin: '0 1rem',
                  height: '8px',
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${rates.totalBugs > 0 ? (rates.bugsInTest / rates.totalBugs) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: 'var(--text-success)',
                  }}
                ></div>
              </div>
              <span style={{ fontWeight: 600, width: '4rem', textAlign: 'right', color: 'var(--text-color)' }}>
                {rates.totalBugs > 0 ? Math.round((rates.bugsInTest / rates.totalBugs) * 100) : 0}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Bug size={16} color="#EF4444" />
                Défauts prod : {rates.bugsInProd}
              </span>
              <div
                style={{
                  flex: 1,
                  margin: '0 1rem',
                  height: '8px',
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${rates.totalBugs > 0 ? (rates.bugsInProd / rates.totalBugs) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: 'var(--text-danger)',
                  }}
                ></div>
              </div>
              <span style={{ fontWeight: 600, width: '4rem', textAlign: 'right', color: 'var(--text-color)' }}>
                {rates.totalBugs > 0 ? Math.round((rates.bugsInProd / rates.totalBugs) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard3;
