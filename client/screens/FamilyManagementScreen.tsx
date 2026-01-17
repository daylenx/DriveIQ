import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useFamily } from '@/context/FamilyContext';
import { useFleet } from '@/context/FleetContext';
import { useData } from '@/context/DataContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Spacing, BorderRadius } from '@/constants/theme';
import { PermissionLevel, FamilyMember, FleetMember, FleetRole } from '@/types';

export default function FamilyManagementScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { vehicles } = useData();
  const { canManageFamily } = usePermissions();
  
  const {
    familyMembers,
    pendingInvites: familyPendingInvites,
    membersUsed: familyMembersUsed,
    memberLimit: familyMemberLimit,
    canAddMember: familyCanAddMember,
    inviteMember: familyInviteMember,
    removeMember: familyRemoveMember,
    updateMemberPermission,
    cancelInvite: familyCancelInvite,
  } = useFamily();
  
  const {
    fleet,
    fleetMembers,
    pendingInvites: fleetPendingInvites,
    inviteMember: fleetInviteMember,
    removeMember: fleetRemoveMember,
    cancelInvite: fleetCancelInvite,
  } = useFleet();
  
  const isFleetMode = !!fleet;
  
  const pendingInvites = isFleetMode ? fleetPendingInvites : familyPendingInvites;
  const membersUsed = isFleetMode ? (fleetMembers.length + 1) : familyMembersUsed;
  const memberLimit = isFleetMode ? Infinity : familyMemberLimit;
  const canAddMember = isFleetMode ? true : familyCanAddMember;

  useEffect(() => {
    if (!canManageFamily) {
      navigation.goBack();
    }
  }, [canManageFamily, navigation]);

  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<PermissionLevel>('full_access');
  const [fleetRole, setFleetRole] = useState<FleetRole>('driver');
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      if (isFleetMode) {
        await fleetInviteMember(email.trim(), fleetRole);
      } else {
        await familyInviteMember(email.trim(), permission, vehicles.map(v => v.id));
      }
      Alert.alert('Success', `Invitation sent to ${email}`);
      setEmail('');
      setShowInviteForm(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveFamilyMember = (member: FamilyMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.memberDisplayName} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await familyRemoveMember(member.memberId);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleRemoveFleetMember = (member: FleetMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove this member from your fleet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await fleetRemoveMember(member.userId);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleTogglePermission = async (member: FamilyMember) => {
    const newPermission: PermissionLevel = member.permission === 'full_access' ? 'view_only' : 'full_access';
    try {
      await updateMemberPermission(member.memberId, newPermission);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update permission');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      if (isFleetMode) {
        await fleetCancelInvite(inviteId);
      } else {
        await familyCancelInvite(inviteId);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel invitation');
    }
  };

  const activeMembers = familyMembers.filter(m => m.status === 'active');

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="h2">Members</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {membersUsed} / {memberLimit === Infinity ? 'Unlimited' : memberLimit} members
          </ThemedText>
        </View>

        {canAddMember ? (
          showInviteForm ? (
            <Card elevation={1} style={styles.inviteForm}>
              <ThemedText type="h4">Invite Member</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Email address"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.permissionRow}>
                <ThemedText type="body">{isFleetMode ? 'Role' : 'Permission Level'}</ThemedText>
                <View style={styles.permissionButtons}>
                  {isFleetMode ? (
                    <>
                      <Pressable
                        style={[
                          styles.permissionButton,
                          {
                            backgroundColor: fleetRole === 'driver' ? theme.primary + '20' : theme.backgroundDefault,
                            borderColor: fleetRole === 'driver' ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setFleetRole('driver')}
                      >
                        <ThemedText type="small" style={{ color: fleetRole === 'driver' ? theme.primary : theme.text }}>
                          Driver
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.permissionButton,
                          {
                            backgroundColor: fleetRole === 'admin' ? theme.primary + '20' : theme.backgroundDefault,
                            borderColor: fleetRole === 'admin' ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setFleetRole('admin')}
                      >
                        <ThemedText type="small" style={{ color: fleetRole === 'admin' ? theme.primary : theme.text }}>
                          Admin
                        </ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        style={[
                          styles.permissionButton,
                          {
                            backgroundColor: permission === 'full_access' ? theme.primary + '20' : theme.backgroundDefault,
                            borderColor: permission === 'full_access' ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setPermission('full_access')}
                      >
                        <ThemedText type="small" style={{ color: permission === 'full_access' ? theme.primary : theme.text }}>
                          Full Access
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.permissionButton,
                          {
                            backgroundColor: permission === 'view_only' ? theme.primary + '20' : theme.backgroundDefault,
                            borderColor: permission === 'view_only' ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => setPermission('view_only')}
                      >
                        <ThemedText type="small" style={{ color: permission === 'view_only' ? theme.primary : theme.text }}>
                          View Only
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setShowInviteForm(false)}
                >
                  <ThemedText type="body">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.inviteButton, { backgroundColor: theme.primary }]}
                  onPress={handleInvite}
                  disabled={isInviting}
                >
                  {isInviting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      Send Invite
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </Card>
          ) : (
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowInviteForm(true)}
            >
              <Feather name="user-plus" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                Invite Member
              </ThemedText>
            </Pressable>
          )
        ) : null}

        {pendingInvites.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>Pending Invites</ThemedText>
            {pendingInvites.map((invite) => {
              const roleOrPermission = isFleetMode 
                ? ('role' in invite ? (invite.role === 'admin' ? 'Admin' : 'Driver') : 'Driver')
                : ('permission' in invite ? (invite.permission === 'full_access' ? 'Full Access' : 'View Only') : 'Full Access');
              return (
                <Card key={invite.id} elevation={1} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <View style={[styles.avatar, { backgroundColor: theme.warning + '30' }]}>
                      <Feather name="clock" size={20} color={theme.warning} />
                    </View>
                    <View style={styles.memberDetails}>
                      <ThemedText type="body">{invite.email}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {roleOrPermission} - Pending
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={[styles.removeButton, { backgroundColor: theme.danger + '20' }]}
                    onPress={() => handleCancelInvite(invite.id)}
                  >
                    <Feather name="x" size={16} color={theme.danger} />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Active Members</ThemedText>
          
          <Card elevation={1} style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <View style={[styles.avatar, { backgroundColor: theme.primary + '30' }]}>
                <Feather name="user" size={20} color={theme.primary} />
              </View>
              <View style={styles.memberDetails}>
                <ThemedText type="body">You (Owner)</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {isFleetMode ? 'Admin' : 'Full Access'} - Primary Account
                </ThemedText>
              </View>
            </View>
          </Card>

          {isFleetMode ? (
            fleetMembers.filter(m => m.userId !== user?.id).map((member) => (
              <Card key={member.id} elevation={1} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <View style={[styles.avatar, { backgroundColor: theme.success + '30' }]}>
                    <Feather name="user" size={20} color={theme.success} />
                  </View>
                  <View style={styles.memberDetails}>
                    <ThemedText type="body">{member.displayName || 'Member'}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {member.email ? `${member.email} - ` : ''}{member.role === 'admin' ? 'Admin' : 'Driver'}
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={[styles.removeButton, { backgroundColor: theme.danger + '20' }]}
                  onPress={() => handleRemoveFleetMember(member)}
                >
                  <Feather name="trash-2" size={16} color={theme.danger} />
                </Pressable>
              </Card>
            ))
          ) : (
            activeMembers.map((member) => (
              <Card key={member.id} elevation={1} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <View style={[styles.avatar, { backgroundColor: theme.success + '30' }]}>
                    <Feather name="user" size={20} color={theme.success} />
                  </View>
                  <View style={styles.memberDetails}>
                    <ThemedText type="body">{member.memberDisplayName}</ThemedText>
                    <Pressable onPress={() => handleTogglePermission(member)}>
                      <ThemedText type="small" style={{ color: theme.primary }}>
                        {member.permission === 'full_access' ? 'Full Access' : 'View Only'} (tap to change)
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  style={[styles.removeButton, { backgroundColor: theme.danger + '20' }]}
                  onPress={() => handleRemoveFamilyMember(member)}
                >
                  <Feather name="trash-2" size={16} color={theme.danger} />
                </Pressable>
              </Card>
            ))
          )}

          {(isFleetMode ? fleetMembers.filter(m => m.userId !== user?.id).length : activeMembers.length) === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="users" size={32} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center' }}>
                No members yet. Invite someone to share vehicle maintenance tracking.
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="info" size={16} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {isFleetMode 
                ? 'Fleet members can view and manage fleet vehicles. Admins have full access, Drivers have limited access.'
                : 'Members can view and manage vehicles you assign to them. View Only members cannot make changes.'}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
  },
  inviteForm: {
    gap: Spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  permissionRow: {
    gap: Spacing.sm,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  permissionButton: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButton: {
    flex: 2,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberDetails: {
    flex: 1,
    gap: 2,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  infoContent: {
    flex: 1,
  },
});
