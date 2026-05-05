import React from 'react';

interface PDFData {
  t: any;
  language: string;
  project: any;
  version: string;
  environment: string;
  startDate: string;
  endDate: string;
  decision: string;
  decisionColor: string;
  isGo: boolean;
  isGoReserve: boolean;
  residualRisks: string;
  signOffs: string;
  bugs: any[];
  m: any;
}

interface TestClosurePDFTemplatesProps {
  pdfRefExec: React.RefObject<HTMLDivElement>;
  pdfRefDetails: React.RefObject<HTMLDivElement>;
  commonPDFStyle: React.CSSProperties;
  data: PDFData;
}

const TestClosurePDFTemplates: React.FC<TestClosurePDFTemplatesProps> = ({
  pdfRefExec,
  pdfRefDetails,
  commonPDFStyle,
  data,
}) => {
  const {
    t,
    language,
    project,
    version,
    environment,
    startDate,
    endDate,
    decision,
    decisionColor,
    isGo,
    isGoReserve,
    residualRisks,
    signOffs,
    bugs,
    m,
  } = data;

  return (
    <>
      {/* FORMAT 1: EXECUTIVE SUMMARY */}
      <div ref={pdfRefExec} style={{ ...commonPDFStyle, display: 'none' }}>
        <div
          style={{
            borderBottom: '3px solid #111827',
            paddingBottom: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>{t('testClosure.pdfExecTitle')}</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>
              {t('testClosure.pdfProjectLabel')} {project?.name} | {t('testClosure.pdfVersionLabel')} {version}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            {t('testClosure.pdfDateLabel')} {new Date().toLocaleDateString(language)}
          </div>
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12pt', color: '#111827' }}>{t('testClosure.pdfContextTitle')}</h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}>
            <strong>{t('testClosure.pdfEnvironmentLabel')}</strong> {environment}
          </p>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}>
            <strong>{t('testClosure.pdfPeriodLabel')}</strong> {t('testClosure.pdfPeriodFromTo', { startDate, endDate })}
          </p>
        </div>

        <div
          style={{
            marginBottom: '20px',
            backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2',
            padding: '20px',
            borderRadius: '8px',
            borderLeft: `6px solid ${decisionColor}`,
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '16pt', color: decisionColor }}>
            {t('testClosure.pdfRecommendation', { decision: decision.replace('_', ' ') })}
          </h2>
          {residualRisks && (
            <div>
              <strong style={{ fontSize: '10pt' }}>{t('testClosure.pdfResidualRisks')}</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{residualRisks}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfExecutionRate')}</div>
            <div
              style={{ fontSize: '24pt', fontWeight: 'bold', color: m.completionRate >= 90 ? '#10B981' : '#F59E0B' }}
            >
              {m.completionRate}%
            </div>
          </div>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfSuccessRate')}</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.passRate >= 95 ? '#10B981' : '#EF4444' }}>
              {m.passRate}%
            </div>
          </div>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfFailureRate')}</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.failureRate <= 5 ? '#10B981' : '#EF4444' }}>
              {m.failureRate}%
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>
            {t('testClosure.pdfRemainingBugs', { count: bugs.filter((b) => b.desc.trim()).length })}
          </h3>
          {bugs.filter((b) => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>{t('testClosure.pdfNoBugs')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSeverity')}</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {bugs
                  .filter((b) => b.desc.trim())
                  .map((b) => (
                    <tr key={b.id}>
                      <td
                        style={{
                          padding: '8px',
                          border: '1px solid #E5E7EB',
                          color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B',
                          fontWeight: 'bold',
                        }}
                      >
                        {t(`testClosure.${b.severity === 'Critique' ? 'critical' : 'major'}`)}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>{t('testClosure.pdfSignOff')}</h3>
          <div
            style={{
              padding: '15px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              minHeight: '80px',
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
            }}
          >
            {signOffs || t('testClosure.pdfNotProvided')}
          </div>
        </div>
      </div>

      {/* FORMAT 2: DETAILED REPORT */}
      <div ref={pdfRefDetails} style={{ ...commonPDFStyle, display: 'none' }}>
        <div
          style={{
            borderBottom: '3px solid #111827',
            paddingBottom: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>{t('testClosure.pdfDetailedTitle')}</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>
              {t('testClosure.pdfProjectLabel')} {project?.name} | {t('testClosure.pdfVersionLabel')} {version}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            {t('testClosure.pdfPeriod', { startDate, endDate })}
          </div>
        </div>

        {/* Détail des sessions/runs */}
        <h3
          style={{
            fontSize: '14pt',
            borderBottom: '1px solid #E5E7EB',
            paddingBottom: '5px',
            marginTop: '20px',
            marginBottom: '15px',
          }}
        >
          {t('testClosure.pdfCampaignInventory')}
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfCampaignName')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfType')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfProgress')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSuccess')}</th>
            </tr>
          </thead>
          <tbody>
            {(m.runs || []).map((r: any) => (
              <tr key={r.id}>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{r.name}</td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  {r.isExploratory ? t('testClosure.pdfExploratory') : t('testClosure.pdfScripted')}
                </td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  {r.completionRate}%
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #E5E7EB',
                    textAlign: 'center',
                    color: r.passRate >= 90 ? '#10B981' : '#EF4444',
                  }}
                >
                  {r.passRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Reprise de la grille des Bugs du rapport 1 */}
        <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>
            {t('testClosure.pdfRemainingBugs', { count: bugs.filter((b) => b.desc.trim()).length })}
          </h3>
          {bugs.filter((b) => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>{t('testClosure.pdfNoBugs')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSeverity')}</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {bugs
                  .filter((b) => b.desc.trim())
                  .map((b) => (
                    <tr key={b.id}>
                      <td
                        style={{
                          padding: '8px',
                          border: '1px solid #E5E7EB',
                          color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B',
                          fontWeight: 'bold',
                        }}
                      >
                        {t(`testClosure.${b.severity === 'Critique' ? 'critical' : 'major'}`)}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            marginTop: '30px',
            backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2',
            padding: '15px',
            borderRadius: '8px',
            borderLeft: `6px solid ${decisionColor}`,
            pageBreakInside: 'avoid',
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '14pt', color: decisionColor }}>
            {t('testClosure.pdfRecommendation', { decision: decision.replace('_', ' ') })}
          </h2>
          <p style={{ margin: '0', fontSize: '9pt', whiteSpace: 'pre-wrap' }}>
            {residualRisks || t('testClosure.pdfNoResidualRisks')}
          </p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>{t('testClosure.pdfApprovals')}</h3>
          <div
            style={{
              padding: '15px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              minHeight: '60px',
              fontSize: '9pt',
              whiteSpace: 'pre-wrap',
            }}
          >
            {signOffs || t('testClosure.pdfNotProvided')}
          </div>
        </div>
      </div>
    </>
  );
};

export default TestClosurePDFTemplates;
