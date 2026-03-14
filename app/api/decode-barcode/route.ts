import { NextResponse } from 'next/server';
import { 
  MultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType, 
  RGBLuminanceSource, 
  BinaryBitmap, 
  HybridBinarizer 
} from '@zxing/library';
import * as jimp from 'jimp';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // 1. Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Process image with Jimp
    const image = await (jimp as any).read(buffer); 
    
    // Proportional resizing: instead of jimp.AUTO, we calculate the height manually
    // to avoid the TypeScript constant error while maintaining aspect ratio.
    if (image.bitmap.width > 1000) {
      const aspectRatio = image.bitmap.height / image.bitmap.width;
      const newWidth = 1000;
      const newHeight = Math.round(newWidth * aspectRatio);
      image.resize(newWidth, newHeight);
    }
    
    const { data, width, height } = image.bitmap;

    // 3. Setup ZXing Reader
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.UPC_A, 
      BarcodeFormat.EAN_13, 
      BarcodeFormat.CODE_128
    ]);
    const reader = new MultiFormatReader();
    reader.setHints(hints);

    // 4. Decode logic with high-contrast grayscale conversion
    const len = width * height;
    const luminances = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i++) {
      // Standard luminance formula for better barcode line detection
      luminances[i] = (
        (data[i * 4] * 0.299) + 
        (data[i * 4 + 1] * 0.587) + 
        (data[i * 4 + 2] * 0.114)
      );
    }

    const source = new RGBLuminanceSource(luminances, width, height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result = reader.decode(binaryBitmap);

    // 5. Success: Return the decoded barcode
    return NextResponse.json({ 
      barcode: result.getText(),
      format: result.getBarcodeFormat().toString() 
    });

  } catch (error) {
    console.error('Barcode Decoding Error:', error);
    return NextResponse.json({ 
      error: 'Could not detect a barcode. Ensure the image is clear and the barcode is flat.' 
    }, { status: 422 });
  }
}