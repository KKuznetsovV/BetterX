import type AppNotification from '../../components/models/AppNotification'
import AuthAwareService from './AuthAware'

export default class NotificationsService extends AuthAwareService {
    async getNotifications(): Promise<AppNotification[]> {
        const { data } = await this.axiosInstance.get<AppNotification[]>(`${import.meta.env.VITE_NOTIFICATION_URL}/notifications`)
        return data
    }

    async markAllRead(): Promise<void> {
        await this.axiosInstance.patch(`${import.meta.env.VITE_NOTIFICATION_URL}/notifications/read`)
    }

    async markOneRead(id: string): Promise<void> {
        await this.axiosInstance.patch(`${import.meta.env.VITE_NOTIFICATION_URL}/notifications/${id}/read`)
    }
}
