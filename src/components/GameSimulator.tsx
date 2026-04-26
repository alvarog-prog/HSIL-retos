import React from 'react';
import { 
  useGestureLaunch, 
  useChallenge, 
  useDetectionMetrics, 
  useGameSession 
} from '../services/game-engine';

const GameSimulator = () => {
  const { castGestureDetected } = useGestureLaunch();
  const { challengeReady, challengeCompleted, progress, instruction, metrics } = useChallenge();
  const { fingerCount, isPinching } = useDetectionMetrics();
  
  const { 
    phase, 
    totalTimeRemaining, 
    phaseTimeRemaining,
    fishCaught, 
    startSession, 
    resetSession,
    sessionMetrics 
  } = useGameSession();

  const getPhaseColor = () => {
    switch(phase) {
      case 'BASELINE': return '#8B949E';
      case 'CASTING': return '#00D4FF';
      case 'CHALLENGE': return '#F97316';
      case 'VISUAL': return '#7C3AED';
      case 'COMPLETE': return '#22C55E';
      default: return '#30363D';
    }
  };

  // Icon mapping for Luis's pixel-art UI
  const getChallengeIcon = (instr: string) => {
    if (instr.includes('dedos')) return '🖐️';
    if (instr.includes('pinza')) return '🤌';
    if (instr.includes('puño')) return '✊';
    if (instr.includes('abre')) return '✋';
    if (instr.includes('sonríe')) return '😊';
    if (instr.includes('cejas')) return '🤨';
    if (instr.includes('relajada')) return '😐';
    if (instr.includes('¿')) return '❓';
    if (instr.includes('cada dedo')) return '🔄';
    if (instr.includes('objetivo')) return '🎯';
    return '🌊';
  };

  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      left: '20px', 
      background: 'rgba(10, 25, 41, 0.95)', 
      padding: '20px', 
      borderRadius: '15px', 
      border: `2px solid ${getPhaseColor()}`,
      color: 'white',
      zIndex: 1000,
      width: '340px',
      fontFamily: 'monospace',
      boxShadow: `0 0 20px ${getPhaseColor()}44`,
      backdropFilter: 'blur(12px)',
      transition: 'border-color 0.5s ease'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: getPhaseColor(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🎮 STEADYARC SESSION</span>
        <span style={{ fontSize: '0.7rem', background: '#30363D', padding: '2px 8px', borderRadius: '4px' }}>
          {Math.ceil(totalTimeRemaining / 1000)}s
        </span>
      </h3>

      {phase === 'IDLE' ? (
        <button 
          onClick={startSession}
          style={{ 
            width: '100%', 
            padding: '15px', 
            background: 'linear-gradient(45deg, #00D4FF, #7C3AED)', 
            border: 'none', 
            borderRadius: '8px', 
            color: 'white', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          INICIAR SESIÓN (60s)
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ color: '#8B949E' }}>FASE:</span>
            <span style={{ fontWeight: 'bold', color: getPhaseColor() }}>{phase}</span>
          </div>
          
          <div style={{ width: '100%', height: '4px', background: '#30363D', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${(phaseTimeRemaining / 20000) * 100}%`,
              height: '100%', 
              background: getPhaseColor(),
              transition: 'width 0.1s linear'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#8B949E' }}>
            <span>Peces: {fishCaught}</span>
            <span>Dedos: {fingerCount} | Pinza: {isPinching ? 'SÍ' : 'NO'}</span>
          </div>

          <div style={{ minHeight: '120px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            {phase === 'BASELINE' && <div style={{ color: '#8B949E' }}>{getChallengeIcon('relajada')}<br/>Calibrando línea base...</div>}
            
            {(phase === 'CASTING' || phase === 'CHALLENGE') && (
              <>
                {!challengeReady ? (
                  <div style={{ color: castGestureDetected ? '#00D4FF' : '#FFF' }}>
                    {phase === 'CASTING' ? (castGestureDetected ? '¡LANZA!' : '✋ Mano abierta para pescar') : 'Esperando reto...'}
                  </div>
                ) : (
                  <div style={{ color: '#F97316' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{getChallengeIcon(instruction)}</div>
                    <div style={{ fontWeight: 'bold' }}>{instruction}</div>
                  </div>
                )}
              </>
            )}

            {phase === 'VISUAL' && <div style={{ color: '#7C3AED' }}>👁️ Siga a los peces</div>}

            {challengeReady && (
               <div style={{ width: '100%', height: '8px', background: '#30363D', borderRadius: '4px', marginTop: '15px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#F97316', transition: 'width 0.1s' }} />
               </div>
            )}
          </div>

          {phase === 'COMPLETE' && (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #22C55E' }}>
              <div style={{ color: '#22C55E', fontWeight: 'bold', textAlign: 'center' }}>SESIÓN FINALIZADA</div>
              <button onClick={resetSession} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#22C55E', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>VOLVER</button>
            </div>
          )}

          {phase !== 'COMPLETE' && (
            <button onClick={resetSession} style={{ fontSize: '0.7rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right' }}>Abandonar</button>
          )}

        </div>
      )}
    </div>
  );
};

export default GameSimulator;
