const AIWorkforceHero = () => {
  return <section className="relative py-0 bg-background overflow-hidden min-h-0 flex items-center justify-center -mt-4">
      {/* Floating Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-20 h-20 rounded-full opacity-60 animate-float" style={{
        backgroundColor: '#FF6B6B',
        top: '20%',
        left: '10%',
        animationDelay: '0s'
      }} />
        <div className="absolute w-32 h-32 rounded-full opacity-60 animate-float" style={{
        backgroundColor: '#6056FF',
        top: '60%',
        right: '15%',
        animationDelay: '2s'
      }} />
        <div className="absolute w-16 h-16 rounded-full opacity-60 animate-float" style={{
        backgroundColor: '#FFEE58',
        bottom: '30%',
        left: '20%',
        animationDelay: '4s'
      }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-4xl text-center px-5">
        {/* Badge Image - positioned on border */}
        <img src="https://71bed9839f6b63de0d12cd02f4fd4947.cdn.bubble.io/f1754095693611x295787058622864830/who_its_for.svg" alt="Who's it for" className="w-48 h-28 mx-auto mb-5 absolute -top-4 left-1/2 transform -translate-x-1/2" />
        
        {/* Main Heading */}
        <h1 className="text-5xl md:text-6xl font-montserrat font-extrabold text-foreground leading-tight mb-8 lg:text-7xl mt-20">
          No technical background required.{' '}
          <span className="bg-gradient-to-r from-[#6056FF] to-[#FE7587] bg-clip-text text-transparent">
            Scale excellence
          </span>{' '}
          across every area or team.
        </h1>
        
        {/* Sub Heading */}
        <p className="text-2xl md:text-3xl font-roboto font-medium text-muted-foreground leading-relaxed mb-5 lg:text-3xl">
          With your intelligent, purpose-built AI workforce.
        </p>
        
        {/* Tagline */}
        <p className="text-xl md:text-2xl font-roboto font-semibold text-foreground mb-12">
          Your next hire isn't human.
        </p>
        
        {/* Feature Pills */}
        <div className="flex justify-center gap-5 flex-wrap">
          {[{
          emoji: '🚀',
          text: 'Instant Deployment'
        }, {
          emoji: '🎯',
          text: 'Purpose-Built'
        }, {
          emoji: '📈',
          text: 'Scalable Excellence'
        }, {
          emoji: '⚡',
          text: 'Zero Technical Skills'
        }].map((pill, index) => <div key={index} className="bg-card text-muted-foreground px-6 py-3 rounded-full text-base font-semibold shadow-lg border-2 border-border transition-all duration-300 ease-in-out hover:bg-brand hover:text-white hover:-translate-y-1 hover:shadow-xl hover:border-brand cursor-pointer">
              <span className="mr-2">{pill.emoji}</span>
              {pill.text}
            </div>)}
        </div>
      </div>
    </section>;
};
export default AIWorkforceHero;