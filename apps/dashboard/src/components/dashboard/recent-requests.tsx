import { ArrowRight, Activity } from 'lucide-react'

export interface RecentRequestItem {
  status: string
  statusType: 'success' | 'error'
  provider: string
  model: string
  latency: string
  cost: string
  timestamp: string
  cached: boolean
}

interface RecentRequestsProps {
  recentRequests: RecentRequestItem[]
  periodLabel: string
  providerFilter: string
  providerName: string
}

export function RecentRequests({ recentRequests, periodLabel, providerFilter, providerName }: RecentRequestsProps) {
  return (
    <div className="bg-[#1c1b1b] rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Recent Requests</h2>
          <p className="text-xs text-[#e5e2e1]/40 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{periodLabel}{providerFilter !== 'all' ? ` · ${providerName}` : ''}</p>
        </div>
        <a href="/dashboard/usage" className="text-sm font-medium text-[#ffba38] hover:text-[#c78b00] transition-colors flex items-center gap-1 self-start sm:self-auto">
          View All Logs <ArrowRight className="w-4 h-4" />
        </a>
      </div>
      <div className="w-full overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] border-b border-[#4f453f]/15">
              <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Status</th>
              <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Provider & Model</th>
              <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Latency</th>
              <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Cost</th>
              <th className="pb-3 px-4 font-medium text-right" style={{ fontFamily: 'Inter, sans-serif' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono text-[#e5e2e1]">
            {recentRequests.length > 0 ? recentRequests.map((req, i) => (
              <tr key={i} className="border-b border-[#4f453f]/10 hover:bg-[#353534]/50 transition-colors">
                <td className="py-4 px-4">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-sans font-medium ${req.statusType === 'success' ? 'bg-[#5a4136]/30 text-[#e2bfb0]' : 'bg-[#93000a]/30 text-[#ffb4ab]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${req.statusType === 'success' ? 'bg-emerald-400' : 'bg-[#ffb4ab]'}`} />
                    {req.status}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-sans font-medium text-[#e5e2e1] capitalize">{req.provider}</span>
                    <span className="text-xs text-[#e5e2e1]/60">{req.model}</span>
                  </div>
                </td>
                <td className={`py-4 px-4 ${req.cached ? 'text-[#ffba38]' : 'text-[#e5e2e1]/60'}`}>{req.latency}</td>
                <td className="py-4 px-4 text-[#e5e2e1]/60">${req.cost}</td>
                <td className="py-4 px-4 text-right text-[#e5e2e1]/70">{req.timestamp}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#e5e2e1]/40 text-sm">
                    <Activity className="w-8 h-8 text-[#e5e2e1]/20" />
                    {providerFilter !== 'all' ? `No recent requests for ${providerName}` : 'No recent requests'}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
