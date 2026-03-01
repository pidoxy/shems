import { Sofa, BedDouble, UtensilsCrossed, BookOpen, Home } from 'lucide-react';

const MAP = {
  sofa:      Sofa,
  bed:       BedDouble,
  utensils:  UtensilsCrossed,
  'book-open': BookOpen,
};

export default function RoomIcon({ iconKey, size = 18, color = 'currentColor', strokeWidth = 1.8 }) {
  const Icon = MAP[iconKey] || Home;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
