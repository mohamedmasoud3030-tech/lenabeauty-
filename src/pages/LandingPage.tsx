import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, Star, Zap, Users, Shield, Clock,
  Smartphone, BarChart3, Sparkles, Play, Globe, Monitor, CalendarDays, CreditCard, MessageSquareHeart
} from "lucide-react";

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const nextLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  };

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t("Lightning Fast POS"),
      description: t("Checkout, VAT, loyalty, gift cards, packages, and invoice printing in one flow."),
      color: "amber"
    },
    {
      icon: <CalendarDays className="h-6 w-6" />,
      title: t("Book online"),
      description: t("Public booking, appointment management, deposits, and no-show protection."),
      color: "rose"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t("Client Portal"),
      description: t("Customers can review appointments, invoices, loyalty, referrals, and reschedule online."),
      color: "blue"
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: t("Advanced Analytics"),
      description: t("Revenue, inventory forecasts, finance views, and business performance in real time."),
      color: "emerald"
    },
    {
      icon: <Monitor className="h-6 w-6" />,
      title: t("Desktop-Ready"),
      description: t("Tauri desktop foundation with backup, restore, print queue, and offline-ready architecture."),
      color: "purple"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t("Secure & Reliable"),
      description: t("Role-based flows, Supabase-ready backend, and protected operational foundations."),
      color: "indigo"
    }
  ];

  const pillars = [
    t("VAT + GCC-ready invoicing"),
    t("Online booking + reschedule/cancel"),
    t("Client portal + loyalty + referrals"),
    t("Notifications + payment gateway settings"),
    t("Gift cards + service packages"),
    t("Desktop foundation + print workflows"),
  ];

  const testimonials = [
    {
      name: t("Operations Team"),
      salon: t("Multi-service beauty center"),
      text: t("We can manage booking, POS, and client follow-up from one system instead of scattered tools."),
      rating: 5
    },
    {
      name: t("Front Desk Lead"),
      salon: t("Premium salon"),
      text: t("The booking and customer portal experience reduces manual calls and saves time every day."),
      rating: 5
    },
    {
      name: t("Owner"),
      salon: t("Growing branch network"),
      text: t("LenaBeauty gives us a practical path from web operations to desktop-ready workflows."),
      rating: 5
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-card/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">L</div>
            <span className="font-bold text-lg text-foreground">LenaBeauty</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLanguage} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all font-bold text-xs uppercase tracking-widest">
              <Globe className="h-4 w-4" />
              {i18n.language === "ar" ? "English" : "العربية"}
            </button>
            <button onClick={() => navigate("/book")} className="px-4 sm:px-6 py-2.5 rounded-lg border border-primary/30 text-primary font-bold text-sm uppercase tracking-widest hover:bg-primary/10 transition-all">
              {t("Book Now")}
            </button>
            <button onClick={() => navigate("/login")} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl">
              {t("Open App")}
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={container} initial="hidden" animate="show" className="text-center space-y-8">
            <motion.div variants={item} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary w-fit mx-auto">
              <Sparkles className="h-4 w-4" />
              {t("Salon operations, booking, portal, and desktop foundation")}
            </motion.div>

            <motion.h1 variants={item} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-foreground leading-tight">
              {t("Run Your Salon")}
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {t("From Front Desk to Desktop")}
              </span>
            </motion.h1>

            <motion.p variants={item} className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t("LenaBeauty brings POS, appointments, customer portal, loyalty, reports, forecasting, and desktop-ready workflows into one product built for beauty businesses in Oman and the GCC.")}
            </motion.p>

            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button onClick={() => navigate("/login")} className="group relative px-8 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span className="relative z-10">{t("Open Dashboard")}</span>
                <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate("/portal")} className="px-8 h-14 rounded-xl border-2 border-border bg-card text-foreground font-bold text-base uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-3">
                <Users className="h-5 w-5" />
                {t("Open Client Portal")}
              </button>
            </motion.div>

            <motion.div variants={item} className="grid grid-cols-3 gap-4 sm:gap-8 pt-12">
              {[
                { number: "24/7", label: t("Booking Access") },
                { number: "POS+CRM", label: t("Unified Flow") },
                { number: "Desktop", label: t("Foundation Ready") }
              ].map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.number}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div key={idx} variants={item} className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 shadow-inner
                  ${feature.color === "amber" && "bg-amber-500/10 text-amber-600"}
                  ${feature.color === "blue" && "bg-blue-500/10 text-blue-600"}
                  ${feature.color === "emerald" && "bg-emerald-500/10 text-emerald-600"}
                  ${feature.color === "rose" && "bg-rose-500/10 text-rose-600"}
                  ${feature.color === "purple" && "bg-purple-500/10 text-purple-600"}
                  ${feature.color === "indigo" && "bg-indigo-500/10 text-indigo-600"}`}>{feature.icon}</div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={item} className="text-4xl sm:text-5xl font-bold text-foreground mb-4">{t("Built Around Real Salon Workflows")}</motion.h2>
            <motion.p variants={item} className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("Not generic software — LenaBeauty is shaped around appointment desks, service retail, loyalty, customer follow-up, and operational clarity.")}</motion.p>
          </motion.div>

          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 gap-4">
            {pillars.map((pillar, idx) => (
              <motion.div key={idx} variants={item} className="rounded-2xl border border-border bg-card/50 p-5 flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="font-medium text-foreground">{pillar}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={item} className="text-4xl sm:text-5xl font-bold text-foreground mb-4">{t("What Teams Like About It")}</motion.h2>
            <motion.p variants={item} className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("A practical product story for reception, operations, and owner visibility.")}</motion.p>
          </motion.div>

          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <motion.div key={idx} variants={item} className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 hover:shadow-xl transition-all">
                <div className="flex gap-1 mb-4">{[...Array(testimonial.rating)].map((_, i) => <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-foreground mb-6 leading-relaxed">"{testimonial.text}"</p>
                <div>
                  <p className="font-bold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.salon}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 text-center space-y-6">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">{t("Ready to Explore LenaBeauty?")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("Open the app, try online booking, or enter the client portal to see how the experience fits together.")}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate("/login")} className="group relative px-8 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden mx-auto sm:mx-0">
                <span className="relative z-10">{t("Open App")}</span>
                <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate("/book")} className="px-8 h-14 rounded-xl border-2 border-border bg-card text-foreground font-bold text-base uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-3 mx-auto sm:mx-0">
                <Clock className="h-5 w-5" />
                {t("Try Booking")}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/20 bg-card/30 backdrop-blur-sm py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm text-muted-foreground">
            <p>&copy; 2026 LenaBeauty. {t("All rights reserved.")}</p>
            <div className="flex gap-4">
              <button onClick={() => navigate('/portal')} className="hover:text-primary transition-colors">{t("Client Portal")}</button>
              <button onClick={() => navigate('/book')} className="hover:text-primary transition-colors">{t("Online Booking")}</button>
            </div>
          </div>
          <div className="pt-6 border-t border-border/10 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-foreground">{t("Built for salons in Oman and the GCC")}</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {t("POS + Invoices")}</span>
              <span className="flex items-center gap-1"><MessageSquareHeart className="h-3.5 w-3.5" /> {t("Portal + Loyalty")}</span>
              <span className="flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> {t("PWA + Desktop-Ready")}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
