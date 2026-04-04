"use client";

import { motion } from "framer-motion";
import { Shot } from "@/core/types";

interface ShotCardProps {
  shot: Shot;
}

export default function ShotCard({ shot }: ShotCardProps) {
  const getStatusColor = () => {
    switch (shot.status) {
      case 'pending':
        return 'bg-white/30';
      case 'generating':
        return 'bg-[#FF5000] shadow-[0_0_8px_rgba(255,80,0,0.8)]';
      case 'completed':
        return 'bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.8)]';
      default:
        return 'bg-white/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 * parseInt(shot.id.split('_')[1]) }}
      whileHover={{ translateY: -4, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.6)" }}
      className="rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden flex flex-col shadow-2xl shadow-black/50 transition-all hover:border-white/20"
    >
      {/* Top Image Area */}
      <div
        className={`aspect-video relative w-full flex items-center justify-center p-4 ${
          shot.status === 'pending'
            ? 'bg-[#0A0A0A] border-2 border-dashed border-white/10'
            : shot.status === 'generating'
            ? 'bg-[#0A0A0A] relative overflow-hidden border border-[#FF5000]/50 animate-pulse'
            : 'bg-gradient-to-br from-gray-800 to-black'
        }`}
      >
        {shot.status === 'pending' && (
          <span className="font-mono text-xs tracking-widest text-white/30">
            PENDING_RENDER
          </span>
        )}
        {shot.status === 'generating' && (
          <div className="relative z-10 font-mono text-xs tracking-widest text-[#FF5000] animate-pulse">
            SYNTHESIZING...
          </div>
        )}
        {shot.status === 'completed' && (
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
        )}
      </div>

      {/* Bottom Metadata Area */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-white/50 uppercase tracking-wider">
            SHOT_{shot.id.split('_')[1].padStart(2, '0')}
          </span>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>
        <p className="text-sm text-white font-medium line-clamp-2 font-mono">
          {shot.action}
        </p>
        {shot.cameraMovement && (
          <p className="text-xs text-white/50 font-mono">
            {shot.cameraMovement}
          </p>
        )}
      </div>
    </motion.div>
  );
}
