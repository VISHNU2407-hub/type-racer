// Confetti canvas component - added inside App.tsx
function ConfettiCanvas({ finished, width, height }: { finished: boolean; width: number; height: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particles = React.useState([])[1];
  const animationId = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!finished) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = width;
    canvas.height = height;
    
    // Generate particles
    const colors = ['#00d4aa', '#ff6b6b', '#feca57', '#48d0b0ffe', '#ffe66d'];
    const particleCount = 100;
    const particlesArray = [];
    
    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      particlesArray.push({
        x: Math.random() * width,
        y: Math.random() * height,
        width: Math.random() * 10 + 5,
        height: Math.random() * 10 + 5,
        color: color,
        velocityX: (Math.random() - 0.5) * 20,
        velocityY: (Math.random() - 0.5) * 20,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 30,
      });
    }
    
    let animationFrame = 0;
    
    function animate() {
      animationFrame++;
      ctx.clearRect(0, 0, width, height);
      
      particlesArray.forEach(particle => {
        particle.x += particle.velocityX * (1 - animationFrame / 100);
        particle.y += particle.velocityY * (1 - animationFrame / 100);
        particle.rotation += particle.rotationSpeed * (1 - animationFrame / 100);
        
        ctx.save();
        ctx.translate(particle.x + particle.width / 2, particle.y + particle.height / 2);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
        ctx.restore();
      });
      
      if (animationFrame < 100) {
        animationId.current = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animationId.current!);
      }
    }
    
    if (finished) {
      animate();
    }
    
    return () => {
      cancelAnimationFrame(animationId.current!);
    };
  }, [finished, width, height]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
  );
}