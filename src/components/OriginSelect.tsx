import { origins } from '../data/origins'
import { OriginType, OriginData } from '../types/game'
import './OriginSelect.css'

interface OriginSelectProps {
  onSelect: (origin: OriginType) => void
}

export default function OriginSelect({ onSelect }: OriginSelectProps) {
  return (
    <div className="origin-select">
      <h2>铨 选 出 身</h2>
      <p className="quote">先选个出身，毕竟在上位者眼里，诸位大人的斤两从一开始便标好了价。</p>
      
      <div className="origin-grid">
        {(Object.values(origins) as OriginData[]).map((origin) => (
          <div 
            key={origin.type} 
            className={`origin-card origin-${origin.type}`}
            onClick={() => onSelect(origin.type)}
          >
            <div className="card-header">
              <h3>{origin.name}</h3>
              <span className="rank-info">
                <span className="rank-label">{origin.initialRank || '待定'}</span>
                <span className="rank-value">{origin.initialDegree || '进士'}</span>
              </span>
            </div>
            
            <div className="tags">
              {origin.tags.map((tag, i) => (
                <span key={i} className="tag">{tag}</span>
              ))}
            </div>
            
            <p className="background">{origin.background}</p>
            
            <div className="attributes">
              <h4>初始属性</h4>
              {Object.entries(origin.initialAttributes).map(([key, value]) => (
                <div key={key} className="attr-row">
                  <span className="attr-name">{key}</span>
                  <div className="attr-bar-container">
                    <div className="attr-bar">
                      <div 
                        className="attr-fill" 
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="attr-value">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="select-btn"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(origin.type)
              }}
            >
              选 此 出 身
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
