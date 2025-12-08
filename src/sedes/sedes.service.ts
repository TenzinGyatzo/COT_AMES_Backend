import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sede, SedeDocument } from './schemas/sede.schema';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Injectable()
export class SedesService {
  constructor(@InjectModel(Sede.name) private sedeModel: Model<SedeDocument>) {}

  async create(createSedeDto: CreateSedeDto): Promise<Sede> {
    try {
      const sede = new this.sedeModel(createSedeDto);
      return await sede.save();
    } catch {
      throw new BadRequestException('Error al crear la sede');
    }
  }

  async findAll(): Promise<Sede[]> {
    return await this.sedeModel.find().exec();
  }

  async findOne(id: string): Promise<Sede> {
    const sede = await this.sedeModel.findById(id).exec();
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }
    return sede;
  }

  async update(id: string, updateSedeDto: UpdateSedeDto): Promise<Sede> {
    const sede = await this.sedeModel
      .findByIdAndUpdate(id, updateSedeDto, { new: true })
      .exec();
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }
    return sede;
  }

  async toggleActivo(id: string): Promise<Sede> {
    const sede = await this.sedeModel.findById(id).exec();
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }
    sede.activo = !sede.activo;
    return await sede.save();
  }
}
