import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'

const storageService = {
  // Upload site image
  uploadSiteImage: async (siteId, file) => {
    try {
      const fileExtension = file.name.split('.').pop()
      const fileName = `site_${Date.now()}.${fileExtension}`
      const storageRef = ref(storage, `sites/${siteId}/${fileName}`)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        fileName: fileName
      }
    } catch (error) {
      console.error('Error uploading site image:', error)
      throw error
    }
  },

  // Upload building image
  uploadBuildingImage: async (buildingId, file) => {
    try {
      const fileExtension = file.name.split('.').pop()
      const fileName = `building_${Date.now()}.${fileExtension}`
      const storageRef = ref(storage, `buildings/${buildingId}/${fileName}`)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        fileName: fileName
      }
    } catch (error) {
      console.error('Error uploading building image:', error)
      throw error
    }
  },

  // Upload process image
  uploadProcessImage: async (processId, file) => {
    try {
      const fileExtension = file.name.split('.').pop()
      const fileName = `process_${Date.now()}.${fileExtension}`
      const storageRef = ref(storage, `processes/${processId}/${fileName}`)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        fileName: fileName
      }
    } catch (error) {
      console.error('Error uploading process image:', error)
      throw error
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (userId, file) => {
    try {
      const fileExtension = file.name.split('.').pop()
      const fileName = `profile_${Date.now()}.${fileExtension}`
      const storageRef = ref(storage, `profiles/${userId}/${fileName}`)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        fileName: fileName
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      throw error
    }
  },

  // Delete image
  deleteImage: async (imagePath) => {
    try {
      const storageRef = ref(storage, imagePath)
      await deleteObject(storageRef)
      return true
    } catch (error) {
      console.error('Error deleting image:', error)
      throw error
    }
  },

  // Get download URL
  getImageUrl: async (imagePath) => {
    try {
      const storageRef = ref(storage, imagePath)
      return await getDownloadURL(storageRef)
    } catch (error) {
      console.error('Error getting image URL:', error)
      throw error
    }
  }
}

export default storageService
