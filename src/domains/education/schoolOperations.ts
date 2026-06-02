import { User } from 'firebase/auth';
import { ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type SchoolTrackInput = {
  user: User;
  trackId: string;
  title: string;
  level: string;
};

export async function enrollSchoolTrack(input: SchoolTrackInput) {
  const now = Date.now();
  await update(ref(realtimeDb), {
    [`schoolEnrollments/${input.user.uid}/${input.trackId}`]: {
      id: input.trackId,
      title: input.title,
      level: input.level,
      progress: 8,
      status: 'started',
      enrolledAt: now,
      updatedAt: serverTimestamp()
    }
  });
}

export async function updateSchoolProgress(user: User, trackId: string, progress: number) {
  const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
  await update(ref(realtimeDb), {
    [`schoolEnrollments/${user.uid}/${trackId}/progress`]: nextProgress,
    [`schoolEnrollments/${user.uid}/${trackId}/status`]: nextProgress >= 100 ? 'completed' : 'started',
    [`schoolEnrollments/${user.uid}/${trackId}/updatedAt`]: serverTimestamp()
  });
}

export async function joinSchoolClass(input: SchoolTrackInput) {
  const classId = `${input.trackId}_community`;
  const now = Date.now();
  await update(ref(realtimeDb), {
    [`schoolClasses/${classId}/id`]: classId,
    [`schoolClasses/${classId}/title`]: `${input.title} - Classe communautaire`,
    [`schoolClasses/${classId}/trackId`]: input.trackId,
    [`schoolClasses/${classId}/members/${input.user.uid}`]: {
      uid: input.user.uid,
      name: input.user.displayName || 'Apprenant AfriSell',
      avatar: input.user.photoURL || '',
      joinedAt: now
    },
    [`userSchoolClasses/${input.user.uid}/${classId}`]: true
  });
}
