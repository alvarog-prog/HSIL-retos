import React, { useEffect, useState } from 'react';
import { SessionJSON } from '../services/game-engine';

interface SessionBridgeProps {
  sessionData: SessionJSON | null;
  onNewSession: () => void;
}

function validateSessionJSON(data: SessionJSON): boolean {
  const required = ['pinch_precision', 'finger_individuation', 'RT_gaze_to_grip', 
                    'facial_symmetry_index_lower', 'fish_caught'];
  return required.every(key => data[key] !== undefined && data[key] !== null);
}

const SessionBridge: React.FC<SessionBridgeProps> = ({ sessionData, onNewSession }) => {
  const [prevSession, setPrevSession] = useState<SessionJSON | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (!sessionData) return;

    // Validation
    const valid = validateSessionJSON(sessionData);
    setIsValid(valid);

    if (!valid) {
      const enrichedData = { ...sessionData, session_quality: 'incomplete' };
      localStorage.setItem('steadyarc_session_latest', JSON.stringify(enrichedData));
    }

    // Load previous session for comparison
    // We look for session_id - 1 or the most recent one in the keys
    const keys = Object.keys(localStorage).filter(k => k.startsWith('steadyarc_session_')).sort();
    if (keys.length > 1) {
      const prevKey = keys[keys.length - 2]; // The one before the current latest
      const prevData = localStorage.getItem(prevKey);
      if (prevData) setPrevSession(JSON.parse(prevData));
    }
  }, [sessionData]);

  if (!sessionData) return null;

  const openDashboard = () => {
    window.open('http://localhost:3000', '_blank');
  };

  const MetricBox = ({ label, value, unit, prevValue, color }: any) => {
    const diff = prevValue ? (value - prevValue).toFixed(2) : null;
    const isPositive = diff && parseFloat(diff) >= 0;

    return (
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', border: `1px solid ${color}44` }}>
        <div style={{ color: '#8B949E', fontSize: '0.65rem', fontWeight: 800, marginBottom: '5px' }}>{label.toUpperCase()}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFF' }}>{typeof value === 'number' ? value.toFixed(2) : value}</div>
          <div style={{ fontSize: '0.8rem', color: '#8B949E' }}>{unit}</div>
        </div>
        {diff && (
          <div style={{ fontSize: '0.7rem', color: isPositive ? '#22C55E' : '#EF4444', marginTop: '4px' }}>
            {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(diff))} vs anterior
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(13, 17, 23, 0.95)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{
        width: '500px',
        padding: '40px',
        background: '#161B22',
        borderRadius: '24px',
        border: '1px solid #30363D',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🐠</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFF', margin: '0 0 5px 0' }}>¡SESIÓN COMPLETADA!</h2>
        <p style={{ color: '#8B949E', marginBottom: '30px' }}>Has recolectado <strong>{sessionData.fish_caught} peces</strong></p>

        {!isValid && (
          <div style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#F97316', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '20px', border: '1px solid #F9731644' }}>
            ⚠️ Algunos datos clínicos no se pudieron capturar completamente.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
          <MetricBox 
            label="Precisión Pinza" 
            value={sessionData.pinch_precision} 
            unit="pts" 
            prevValue={prevSession?.pinch_precision}
            color="#00D4FF" 
          />
          <MetricBox 
            label="Individuación" 
            value={sessionData.finger_individuation} 
            unit="/5" 
            prevValue={prevSession?.finger_individuation}
            color="#7C3AED" 
          />
          <div style={{ gridColumn: 'span 2' }}>
            <MetricBox 
              label="Puntuación Cognitiva" 
              value={sessionData.cognitive_motor_score} 
              unit="pts" 
              prevValue={prevSession?.cognitive_motor_score}
              color="#22C55E" 
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={openDashboard}
            style={{
              padding: '16px',
              background: 'linear-gradient(45deg, #00D4FF, #7C3AED)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)'
            }}
          >
            VER INFORME COMPLETO
          </button>
          
          <button 
            onClick={onNewSession}
            style={{
              padding: '12px',
              background: 'transparent',
              border: '1px solid #30363D',
              borderRadius: '12px',
              color: '#8B949E',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            NUEVA SESIÓN
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SessionBridge;
