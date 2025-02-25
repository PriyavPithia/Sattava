import { supabase } from '../lib/supabase';
import { Project, Content } from '../types/database';
import { Message, Chat } from '../types';

export const createProject = async (name: string, description?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        name,
        description,
        user_id: user.id
      }
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }
  
  return data;
};

export const getProjects = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*, content(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }

  return data || [];
};

export const addContent = async (projectId: string, content: Omit<Content, 'id' | 'project_id' | 'created_at' | 'user_id'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('content')
    .insert([{
      ...content,
      project_id: projectId,
      user_id: user.id
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding content:', error);
    throw error;
  }

  return data;
};

export const getProjectContent = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching project content:', error);
    throw error;
  }

  return data;
};

export const deleteProject = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: Partial<Project>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    throw error;
  }

  return data;
};

export const saveChat = async (collectionId: string, messages: Message[]) => {
  console.log('Saving chat for collection:', collectionId);
  console.log('Messages to save:', messages);
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user?.id);
  
  if (!user) {
    console.error('No authenticated user found');
    throw new Error('User not authenticated');
  }

  const messagesWithTimestamp = messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp || new Date().toISOString()
  }));

  console.log('Checking for existing chat...');
  const { data: existingChat, error: fetchError } = await supabase
    .from('chats')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      console.log('No existing chat found, will create new one');
    } else {
      console.error('Error checking for existing chat:', fetchError);
      throw fetchError;
    }
  }

  if (existingChat) {
    console.log('Updating existing chat:', existingChat.id);
    const { error } = await supabase
      .from('chats')
      .update({
        messages: messagesWithTimestamp,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingChat.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
    console.log('Chat updated successfully');
    return existingChat.id;
  } else {
    console.log('Creating new chat');
    const { data, error } = await supabase
      .from('chats')
      .insert({
        collection_id: collectionId,
        user_id: user.id,
        messages: messagesWithTimestamp
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
    console.log('New chat created successfully:', data.id);
    return data.id;
  }
};

export const loadChat = async (collectionId: string): Promise<Message[]> => {
  console.log('Loading chat for collection:', collectionId);
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user?.id);
  
  if (!user) {
    console.error('No authenticated user found');
    throw new Error('User not authenticated');
  }

  console.log('Fetching chat messages from database...');
  const { data, error } = await supabase
    .from('chats')
    .select('messages')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('No existing chat found for this collection');
    } else {
      console.error('Error loading chat:', error);
      throw error;
    }
  }

  console.log('Loaded messages:', data?.messages);
  return (data?.messages || []) as Message[];
};

export const deleteChat = async (chatId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id);

  if (error) throw error;
};

export const getAllChats = async (collectionId: string): Promise<Chat[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}; 