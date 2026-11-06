import { Check, Mail, MessageSquare, Phone, User, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  useCreateContactMutation,
  useUpdateContactMutation,
} from '@/store/api/debts-api';
import { Contact } from '@/types/database.types';

interface ContactFormModalProps {
  visible: boolean;
  onClose: () => void;
  contact?: Contact | null;
  onSuccess?: (contact: Contact) => void;
}

function ContactFormModalContent({
  onClose,
  contact,
  onSuccess,
}: {
  onClose: () => void;
  contact?: Contact | null;
  onSuccess?: (contact: Contact) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxModalHeight = Math.round(windowHeight * 0.85);

  const [name, setName] = React.useState(contact?.name || '');
  const [phone, setPhone] = React.useState(contact?.phone || '');
  const [email, setEmail] = React.useState(contact?.email || '');
  const [whatsapp, setWhatsapp] = React.useState(contact?.whatsapp || '');
  const [notes, setNotes] = React.useState(contact?.notes || '');
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = !!contact;

  const [createContact, { isLoading: isCreating }] = useCreateContactMutation();
  const [updateContact, { isLoading: isUpdating }] = useUpdateContactMutation();
  const isSubmitting = isCreating || isUpdating;

  const handleCopyPhoneToWhatsapp = () => {
    if (phone.trim()) {
      setWhatsapp(phone.trim());
    }
  };

  const handleSubmit = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('Phone number is required');
      return;
    }

    setError(null);

    try {
      if (isEditing && contact) {
        const updated = await updateContact({
          id: contact.id,
          name: name.trim() || null,
          phone: cleanPhone,
          email: email.trim() || null,
          whatsapp: whatsapp.trim() || null,
          notes: notes.trim() || null,
        }).unwrap();
        onSuccess?.(updated);
      } else {
        const created = await createContact({
          name: name.trim() || null,
          phone: cleanPhone,
          email: email.trim() || null,
          whatsapp: whatsapp.trim() || null,
          notes: notes.trim() || null,
        }).unwrap();
        onSuccess?.(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save contact';
      setError(msg);
    }
  };

  return (
    <View className="flex-1 bg-black/60 justify-end">
      <Pressable className="flex-1" onPress={onClose} />
      <View
        className="bg-card rounded-t-3xl border-t border-border px-5 pt-4 overflow-hidden"
        style={{
          maxHeight: maxModalHeight,
          paddingBottom: Math.max(insets.bottom + 12, 24),
        }}>
        {/* Header */}
        <View className="flex-row items-center justify-between pb-3 border-b border-border">
          <View>
            <Text variant="h4" className="font-bold text-foreground">
              {isEditing ? 'Edit User / Contact' : 'Add New User'}
            </Text>
            <Text variant="muted" className="text-xs">
              Only phone number is required
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-8 w-8 rounded-full bg-muted items-center justify-center">
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="py-4 gap-4"
          keyboardShouldPersistTaps="handled">
          {error && (
            <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <Text className="text-xs text-destructive font-medium">{error}</Text>
            </View>
          )}

          {/* Phone (REQUIRED) */}
          <View>
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-foreground">
                Phone Number <Text className="text-destructive">*</Text>
              </Text>
              <View className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                <Text className="text-[10px] font-bold text-primary">Required</Text>
              </View>
            </View>
            <View className="relative">
              <Input
                value={phone}
                onChangeText={(val) => {
                  setPhone(val);
                  if (error) setError(null);
                }}
                placeholder="e.g. 01712345678 or +8801..."
                keyboardType="phone-pad"
                className="pl-10"
              />
              <View className="absolute left-3 top-3">
                <Icon as={Phone} size={16} className="text-muted-foreground" />
              </View>
            </View>
          </View>

          {/* Name (Optional) */}
          <View>
            <Text className="text-xs font-semibold text-foreground mb-1.5">
              Full Name <Text className="text-muted-foreground font-normal">(Optional)</Text>
            </Text>
            <View className="relative">
              <Input
                value={name}
                onChangeText={setName}
                placeholder="e.g. John Doe, Brother, Supplier"
                className="pl-10"
              />
              <View className="absolute left-3 top-3">
                <Icon as={User} size={16} className="text-muted-foreground" />
              </View>
            </View>
          </View>

          {/* WhatsApp (Optional) */}
          <View>
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-foreground">
                WhatsApp Number <Text className="text-muted-foreground font-normal">(Optional)</Text>
              </Text>
              {phone.trim() ? (
                <Pressable
                  onPress={handleCopyPhoneToWhatsapp}
                  className="px-2 py-0.5 rounded bg-muted active:bg-muted/80 border border-border">
                  <Text className="text-[10px] font-semibold text-muted-foreground">
                    Same as Phone
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="relative">
              <Input
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="e.g. 01712345678"
                keyboardType="phone-pad"
                className="pl-10"
              />
              <View className="absolute left-3 top-3">
                <Icon as={MessageSquare} size={16} className="text-muted-foreground" />
              </View>
            </View>
          </View>

          {/* Email (Optional) */}
          <View>
            <Text className="text-xs font-semibold text-foreground mb-1.5">
              Email Address <Text className="text-muted-foreground font-normal">(Optional)</Text>
            </Text>
            <View className="relative">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. contact@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="pl-10"
              />
              <View className="absolute left-3 top-3">
                <Icon as={Mail} size={16} className="text-muted-foreground" />
              </View>
            </View>
          </View>

          {/* Notes (Optional) */}
          <View>
            <Text className="text-xs font-semibold text-foreground mb-1.5">
              Notes / Reference <Text className="text-muted-foreground font-normal">(Optional)</Text>
            </Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Office colleague, shop owner, personal friend"
              multiline
              numberOfLines={2}
              className="min-h-[64px]"
            />
          </View>

          {/* Submit Button */}
          <Button
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-xl flex-row items-center justify-center gap-2">
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Icon as={Check} size={18} className="text-primary-foreground" />
                <Text className="font-bold text-primary-foreground">
                  {isEditing ? 'Save Changes' : 'Create User'}
                </Text>
              </>
            )}
          </Button>
        </ScrollView>
      </View>
    </View>
  );
}

export function ContactFormModal({
  visible,
  onClose,
  contact,
  onSuccess,
}: ContactFormModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <ContactFormModalContent
        key={contact?.id || 'new-contact'}
        onClose={onClose}
        contact={contact}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}
