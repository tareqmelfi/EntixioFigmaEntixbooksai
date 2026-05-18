import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Sparkles } from "lucide-react";

interface AIParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

export function InteractiveDashboard3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [particles, setParticles] = useState<AIParticle[]>([]);
  
  // Mouse position tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring animations
  const springConfig = { stiffness: 150, damping: 15 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);
  
  // 3D transform values
  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);
  const scale = useTransform(smoothMouseX, [-0.5, 0.5], [0.98, 1.02]);
  
  // Light reflection gradient
  const lightGradient = useTransform(
    [smoothMouseX, smoothMouseY],
    ([x, y]) => 
      `radial-gradient(circle at ${((x as number) + 0.5) * 100}% ${((y as number) + 0.5) * 100}%, rgba(255,255,255,0.2) 0%, transparent 50%)`
  );
  
  // Initialize particles
  useEffect(() => {
    const newParticles: AIParticle[] = [];
    const colors = ["#1276E3", "#349FC4", "#0B1A47", "#60A5FA"];
    
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    setParticles(newParticles);
  }, []);
  
  // Update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);
  
  // Animate particles
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Bounce off edges
        if (particle.x < 0 || particle.x > 100) particle.vx *= -1;
        if (particle.y < 0 || particle.y > 100) particle.vy *= -1;
        
        // Draw particle
        const x = (particle.x / 100) * canvas.width;
        const y = (particle.y / 100) * canvas.height;
        
        // Glow effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.radius * 3);
        gradient.addColorStop(0, particle.color + "80");
        gradient.addColorStop(0.5, particle.color + "40");
        gradient.addColorStop(1, particle.color + "00");
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, particle.radius * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core particle
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.beginPath();
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw connections to nearby particles
        particles.forEach((otherParticle, j) => {
          if (i >= j) return;
          
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 15) {
            const otherX = (otherParticle.x / 100) * canvas.width;
            const otherY = (otherParticle.y / 100) * canvas.height;
            
            ctx.strokeStyle = particle.color + Math.floor((1 - distance / 15) * 30).toString(16).padStart(2, "0");
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(otherX, otherY);
            ctx.stroke();
          }
        });
        
        particles[i] = particle;
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(animationId);
  }, [particles, dimensions]);
  
  // Handle mouse movement
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
    mouseX.set(x);
    mouseY.set(y);
  };
  
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };
  
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full perspective-1000"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: "1200px" }}
    >
      {/* AI Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="absolute -top-3 -left-3 z-20 bg-gradient-to-r from-[#1276E3] to-[#349FC4] text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
        style={{ fontSize: "12px", fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        <Sparkles className="w-4 h-4" />
        <span>AI-Powered</span>
      </motion.div>
      
      {/* Animated particles canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 pointer-events-none rounded-xl"
        style={{ mixBlendMode: "screen" }}
      />
      
      {/* 3D Transform container */}
      <motion.div
        className="relative w-full h-full"
        style={{
          rotateX,
          rotateY,
          scale,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glowing border animation */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={{
            boxShadow: [
              "0 0 20px rgba(18, 118, 227, 0.3)",
              "0 0 40px rgba(52, 159, 196, 0.5)",
              "0 0 20px rgba(18, 118, 227, 0.3)",
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Main image with depth layers */}
        <div className="relative bg-gradient-to-br from-[#0B1A47] via-[#122354] to-[#1276E3] rounded-2xl p-1.5 shadow-2xl shadow-[#0B1A47]/30">
          {/* Light reflection overlay */}
          <motion.div
            className="absolute inset-0 rounded-xl opacity-30 pointer-events-none z-20"
            style={{
              background: lightGradient
            }}
          />
          
          {/* Image */}
          <motion.div
            className="relative overflow-hidden rounded-xl"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1759159347934-1cdc38dd1f3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhY2NvdW50aW5nJTIwc29mdHdhcmUlMjBkYXNoYm9hcmQlMjBkYXJrJTIwYmx1ZXxlbnwxfHx8fDE3NzM4MDA5NzN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="Entix Books Dashboard"
              className="rounded-xl w-full relative z-10"
            />
            
            {/* Animated gradient overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: [
                  "linear-gradient(135deg, rgba(18, 118, 227, 0.1) 0%, transparent 50%)",
                  "linear-gradient(225deg, rgba(52, 159, 196, 0.1) 0%, transparent 50%)",
                  "linear-gradient(135deg, rgba(18, 118, 227, 0.1) 0%, transparent 50%)",
                ]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>
        </div>
        
        {/* Depth layers for 3D effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#0B1A47]/20 to-[#1276E3]/20 rounded-2xl blur-xl -z-10"
          style={{ transform: "translateZ(-20px)" }}
        />
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#1276E3]/10 to-[#349FC4]/10 rounded-2xl blur-2xl -z-20"
          style={{ transform: "translateZ(-40px)" }}
        />
      </motion.div>
      
      {/* Corner accents */}
      <motion.div
        className="absolute -bottom-2 -right-2 w-20 h-20 bg-gradient-to-br from-[#1276E3] to-[#349FC4] rounded-full blur-2xl opacity-50 -z-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.7, 0.5]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute -top-2 -left-2 w-16 h-16 bg-gradient-to-br from-[#349FC4] to-[#1276E3] rounded-full blur-2xl opacity-40 -z-10"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.4, 0.6, 0.4]
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />
    </div>
  );
}