import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('issei_user') || '{}')

  function handleLogout() {
    localStorage.removeItem('issei_token')
    localStorage.removeItem('issei_user')
    navigate('/login')
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const monogram = (fullName || user.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-cream px-5 pt-6">
      <h1 className="font-display font-black text-[32px] text-ink leading-none inline-block border-b-[3px] border-ink pb-1">
        You<span className="text-terra">.</span>
      </h1>

      <div className="sticker bg-card p-5 mt-5">
        {/* Monogram as a periwinkle sticker disc — the reference's badge motif. */}
        <div className="w-16 h-16 rounded-full bg-periwinkle text-cream font-display font-black text-3xl flex items-center justify-center border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] mb-4">
          {monogram}
        </div>
        {fullName && (
          <p className="font-display font-black text-[22px] text-ink">
            {fullName}
          </p>
        )}
        <p className="section-label mt-3">Email</p>
        <p className="font-sans text-[14px] text-ink mt-0.5">
          {user.email || 'Unknown'}
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 mt-5 rounded-full bg-cream border-[2.5px] border-ink text-terra font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
      >
        Log out
      </button>
    </div>
  )
}
