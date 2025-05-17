import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

interface Token {
  tokenMint: string;
  amount: number;
}

export type AssetsDocument = mongoose.HydratedDocument<Assets>;

@Schema()
export class Assets {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop()
  assets: Token[];
}

export const AssetsSchema = SchemaFactory.createForClass(Assets);
