export function LiveLoader() {
  return (
    <div className="live-loader" role="img" aria-label="Animated Vibe assistant mascot">
      <div className="live-loader-ghost">
        <div className="live-loader-body">
          <span className="live-loader-pupil live-loader-pupil-left" />
          <span className="live-loader-pupil live-loader-pupil-right" />
          <span className="live-loader-eye live-loader-eye-left" />
          <span className="live-loader-eye live-loader-eye-right" />
          <span className="live-loader-top live-loader-top-0" />
          <span className="live-loader-top live-loader-top-1" />
          <span className="live-loader-top live-loader-top-2" />
          <span className="live-loader-top live-loader-top-3" />
          <span className="live-loader-top live-loader-top-4" />
          <span className="live-loader-stem live-loader-stem-0" />
          <span className="live-loader-stem live-loader-stem-1" />
          <span className="live-loader-stem live-loader-stem-2" />
          <span className="live-loader-stem live-loader-stem-3" />
          <span className="live-loader-stem live-loader-stem-4" />
          <span className="live-loader-stem live-loader-stem-5" />
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} className={`live-loader-antenna live-loader-antenna-${index + 1}`} />
          ))}
        </div>
        <div className="live-loader-shadow" />
      </div>
      <div className="live-loader-copy">
        <span className="eyebrow">Always in motion</span>
        <strong>Your AI team is ready.</strong>
        <p>Describe an idea and watch Vibe turn it into something real.</p>
      </div>
    </div>
  );
}
