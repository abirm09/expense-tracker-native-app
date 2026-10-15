import { Menu } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useAppDispatch } from '@/store';
import { openSidebar } from '@/store/slices/ui-slice';

interface HamburgerButtonProps {
  className?: string;
  size?: number;
}

export function HamburgerButton({ className, size = 18 }: HamburgerButtonProps) {
  const dispatch = useAppDispatch();

  return (
    <Pressable
      onPress={() => dispatch(openSidebar())}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Open sidebar menu"
      accessibilityRole="button"
      className={`h-9 w-9 rounded-xl bg-muted/60 items-center justify-center border border-border active:bg-muted ${
        className ?? ''
      }`}>
      <Icon as={Menu} size={size} className="text-foreground" />
    </Pressable>
  );
}
