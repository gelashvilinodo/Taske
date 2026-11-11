# გეგმა

სტეკი: Next.js (App Router) + TypeScript + Supabase (ბაზა, ავტორიზაცია, realtime), ჰოსტინგი Cloudflare Workers (OpenNext). მისამართი: https://taske.nodogelashvili99.workers.dev

## ეტაპი 1 — გადასვლა Next.js-ზე ✅
- ძველი ერთფაილიანი საიტი გადატანილია Next.js-ზე. ყველა არსებული ფუნქცია შენარჩუნებულია: კვირის ბორდი, სტატუსები, თვე, ფილტრები, სტატისტიკა, თასქის დამატება (რამდენიმე ხაზით ერთად), რედაქტირება, ქვეთასქები, კომენტარები, drag & drop, სხვა კვირაზე გადატანა, დაუსრულებელი თასქების გადმოტანა, Day/Night.
- გვერდები: Board, List, Calendar, Content calendar (ჯერ ცარიელი), Table.
- შესვლა: Apple, Google, მეილი + კოდი (`/login`).
- Supabase-ის გარეშე აპი ლოკალურ რეჟიმში მუშაობს და ბრაუზერში ძველ საიტზე შენახულ თასქებს კითხულობს.

## ეტაპი 2 — Supabase-ის და პროვაიდერების დაყენება (შენი მხარე)
1. supabase.com → New project. SQL Editor-ში გაუშვი `supabase/migrations/20261111000000_init.sql`.
2. Project Settings → API: `Project URL` და publishable (ან anon) key → `.env.local` (`.env.example`-ის მიხედვით).
3. Authentication → URL Configuration: Site URL = `https://taske.nodogelashvili99.workers.dev`; Redirect URLs: `http://localhost:3000/**` და `https://taske.nodogelashvili99.workers.dev/**`.
4. Authentication → Email Templates → Magic Link: ჩასვი `{{ .Token }}`, რომ 6-ნიშნა კოდი მოვიდეს.
5. Google: Google Cloud Console → OAuth client (Web) → redirect URI `https://<project>.supabase.co/auth/v1/callback` → Client ID/Secret → Supabase → Providers → Google.
6. Apple: Apple Developer ($99/წელი) → Services ID + Sign in with Apple key → Supabase → Providers → Apple.
7. რეალური გამოყენებისთვის: Auth → SMTP (მაგ. Resend).

## ეტაპი 3 — ძველი მონაცემების გადატანა ბაზაში
- პირველ შესვლაზე ბრაუზერში დარჩენილი თასქების ბაზაში ატვირთვის შეთავაზება.

## ეტაპი 4 — გაზიარება და მოწვევები
- ცხრილები: workspaces, workspace_members (როლი: owner / editor / viewer), invitations.
- მოწვევა მეილით → დათანხმება / უარყოფა. RLS წევრობის მიხედვით.
- realtime განახლება ყველა წევრისთვის.

## ეტაპი 5 — კალენდარი და კონტენტ-კალენდარი
- events ცხრილი; თვე / კვირა / დღე ხედები (FullCalendar).
- კონტენტ-კალენდარი საათობრივი ხედით.
- კალენდრის გაზიარება და მოვლენაზე მოწვევა (accept / decline).

## ეტაპი 6 — Google Calendar ორმხრივი სინქრონი
- "Google Calendar-ის დაკავშირება" ცალკე calendar scope-ით; refresh token სერვერზე.
- წაკითხვა (get) და ჩაწერა (post), push notification webhook, პერიოდული სინქრონი.
- საჯარო გაშვებამდე Google-ის OAuth ვერიფიკაცია.

## ეტაპი 7 — Apple Calendar
- ჯერ ICS გამოწერის ბმული (ჩვენგან Apple-ში).
- შემდეგ სურვილისამებრ CalDAV (app-specific პაროლით, ორმხრივი).

## ეტაპი 8 — ტესტირება და საკუთარი დომენი Cloudflare-ზე
