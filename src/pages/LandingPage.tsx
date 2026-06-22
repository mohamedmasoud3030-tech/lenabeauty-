import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, Star, Zap, Users, TrendingUp, Shield, Clock,
  Smartphone, BarChart3, Heart, Sparkles, ChevronDown, Play
} from "lucide-react";

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t("Lightning Fast"),
      description: t("Process sales in seconds with our optimized POS system"),
      color: "amber"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t("Customer Management"),
      description: t("Track customer history, preferences, and loyalty points"),
      color: "blue"
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: t("Advanced Analytics"),
      description: t("Get real-time insights into your business performance"),
      color: "emerald"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: t("Appointment Booking"),
      description: t("Manage appointments and staff schedules efficiently"),
      color: "rose"
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: t("Mobile Optimized"),
      description: t("Works perfectly on any device - desktop, tablet, or phone"),
      color: "purple"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t("Secure & Reliable"),
      description: t("Enterprise-grade security with automatic backups"),
      color: "indigo"
    }
  ];

  const plans = [
    {
      name: t("Starter"),
      price: "15",
      monthlyPrice: "15 OMR",
      yearlyPrice: "150 OMR",
      description: t("Perfect for small salons"),
      features: [
        t("Up to 5 employees"),
        t("Basic POS system"),
        t("Customer management"),
        t("Simple reports"),
        t("Mobile app access"),
        t("Email support"),
      ],
      popular: false
    },
    {
      name: t("Professional"),
      price: "35",
      monthlyPrice: "35 OMR",
      yearlyPrice: "350 OMR",
      description: t("Most popular for growing salons"),
      features: [
        t("Up to 20 employees"),
        t("Advanced POS system"),
        t("Full customer management"),
        t("Advanced analytics"),
        t("Mobile app access"),
        t("WhatsApp notifications"),
        t("Appointment reminders"),
        t("Priority support"),
      ],
      popular: true
    },
    {
      name: t("Enterprise"),
      price: "75",
      monthlyPrice: "75 OMR",
      yearlyPrice: "750 OMR",
      description: t("For large salon chains"),
      features: [
        t("Unlimited employees"),
        t("Full POS system"),
        t("Complete customer management"),
        t("Advanced analytics & reports"),
        t("Mobile app access"),
        t("WhatsApp & SMS"),
        t("24/7 Priority support"),
        t("Custom integrations"),
        t("Dedicated account manager"),
      ],
      popular: false
    }
  ];

  const testimonials = [
    {
      name: "أحمد محمد",
      salon: "صالون الفخامة",
      text: "زيادة الإيرادات بنسبة 40% بعد استخدام التطبيق",
      rating: 5
    },
    {
      name: "فاطمة علي",
      salon: "صالون الجمال",
      text: "توفير 3 ساعات يومياً في إدارة العمليات",
      rating: 5
    },
    {
      name: "محمود حسن",
      salon: "صالون النجاح",
      text: "أفضل استثمار قمت به لصالوني",
      rating: 5
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
              K
            </div>
            <span className="font-bold text-lg text-foreground">Kanzy</span>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl"
          >
            {t("Sign In")}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="text-center space-y-8"
          >
            <motion.div variants={item} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary w-fit mx-auto">
              <Sparkles className="h-4 w-4" />
              {t("The #1 Salon Management Platform")}
            </motion.div>

            <motion.h1
              variants={item}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-foreground leading-tight"
            >
              {t("Grow Your Salon Business")}
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {t("Exponentially")}
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              {t("Manage appointments, process sales, track customers, and analyze performance - all in one powerful platform built for modern salons.")}
            </motion.p>

            <motion.div
              variants={item}
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
            >
              <button
                onClick={() => navigate("/login")}
                className="group relative px-8 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span className="relative z-10">{t("Start Free Trial")}</span>
                <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 h-14 rounded-xl border-2 border-border bg-card text-foreground font-bold text-base uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-3">
                <Play className="h-5 w-5" />
                {t("Watch Demo")}
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={item}
              className="grid grid-cols-3 gap-4 sm:gap-8 pt-12"
            >
              {[
                { number: "500+", label: t("Active Salons") },
                { number: "50K+", label: t("Happy Users") },
                { number: "4.9★", label: t("Average Rating") }
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

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.h2 variants={item} className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              {t("Everything You Need")}
            </motion.h2>
            <motion.p variants={item} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("Powerful features designed specifically for salon businesses")}
            </motion.p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                variants={item}
                className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 shadow-inner
                  ${feature.color === "amber" && "bg-amber-500/10 text-amber-600"}
                  ${feature.color === "blue" && "bg-blue-500/10 text-blue-600"}
                  ${feature.color === "emerald" && "bg-emerald-500/10 text-emerald-600"}
                  ${feature.color === "rose" && "bg-rose-500/10 text-rose-600"}
                  ${feature.color === "purple" && "bg-purple-500/10 text-purple-600"}
                  ${feature.color === "indigo" && "bg-indigo-500/10 text-indigo-600"}
                `}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.h2 variants={item} className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              {t("Simple, Transparent Pricing")}
            </motion.h2>
            <motion.p variants={item} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("Choose the plan that fits your salon's needs")}
            </motion.p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {plans.map((plan, idx) => (
              <motion.div
                key={idx}
                variants={item}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  plan.popular
                    ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-2xl scale-105"
                    : "border-border bg-card/50 backdrop-blur-sm hover:shadow-xl"
                }`}
              >
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground px-4 py-2 text-center font-bold text-xs uppercase tracking-widest">
                    {t("Most Popular")}
                  </div>
                )}
                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground font-bold text-sm uppercase tracking-widest">OMR/{t("month")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold">{t("or")} {plan.yearlyPrice} {t("per year")}</p>
                  </div>

                  <button
                    onClick={() => navigate("/login")}
                    className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all ${
                      plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {t("Get Started")}
                  </button>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    {plan.features.map((feature, fidx) => (
                      <div key={fidx} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.h2 variants={item} className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              {t("Loved by Salon Owners")}
            </motion.h2>
            <motion.p variants={item} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("See what salon owners are saying about Kanzy")}
            </motion.p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={idx}
                variants={item}
                className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 hover:shadow-xl transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
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

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 text-center space-y-6"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              {t("Ready to Transform Your Salon?")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("Join hundreds of salon owners who are already growing their business with Kanzy")}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="group relative px-8 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden mx-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative z-10">{t("Start Your Free Trial Today")}</span>
              <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 bg-card/30 backdrop-blur-sm py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2026 Kanzy Spa. {t("All rights reserved.")} | {t("Privacy Policy")} | {t("Terms of Service")}</p>
        </div>
      </footer>
    </div>
  );
}
